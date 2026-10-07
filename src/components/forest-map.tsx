import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, Clock, Flame, MapPin, Minus, Navigation, Plus, RotateCcw } from "lucide-react";
import { cellCenter, cellLabel, getGraphConfig, ZONES, type Forest, type ZoneId } from "@/lib/forests";
import { edgeKey, trailEdges, type EvacuateResult } from "@/lib/pathfinder";
import { predictFireSpread, type ScenarioInputs } from "@/lib/risk-model";
import { cn } from "@/lib/utils";

export type Step = "forest" | "zone" | "cell" | "fire" | "route";

type Props = {
  forest: Forest;
  step: Step;
  zone: ZoneId | null;
  current: number | null;
  fireZones: number[];
  blockedTrails: string[];
  scenario: ScenarioInputs;
  result: EvacuateResult | null;
  busy: boolean;
  onPickZone: (z: ZoneId) => void;
  onPickCell: (i: number) => void;
  onToggleFire: (i: number) => void;
  onToggleBlockedTrail: (edge: string) => void;
  onScenarioChange: (scenario: ScenarioInputs) => void;
  onConfirm: () => void;
  onUpdateLocation: () => void;
  onBack: () => void;
  onReset: () => void;
};

const ORIGIN: Record<ZoneId, string> = { A: "0% 0%", B: "100% 0%", C: "0% 100%", D: "100% 100%" };
const WIND_LABELS: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };

export function ForestMap({ forest, step, zone, current, fireZones, blockedTrails, scenario, result, busy, onPickZone, onPickCell, onToggleFire, onToggleBlockedTrail, onScenarioChange, onConfirm, onUpdateLocation, onBack, onReset }: Props) {
  const gridSize = getGraphConfig(forest.id).gridSize;
  const cellCount = gridSize * gridSize;
  const zoomed = step !== "forest" && step !== "zone";
  const [gridOn, setGridOn] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
    if (!zoomed) { setGridOn(false); return; }
    const t = window.setTimeout(() => setGridOn(true), 280);
    return () => window.clearTimeout(t);
  }, [zoomed, zone, forest.id]);

  const pathPts = useMemo(() => result?.ok ? result.path.map((i) => { const p = cellCenter(i, gridSize); return `${p.x * 100},${p.y * 100}`; }).join(" ") : "", [result, gridSize]);
  const previewSpread = result?.predicted_spread ?? predictFireSpread(forest.id, fireZones, scenario);
  const danger = new Set(result?.danger ?? previewSpread);
  const predicted = new Set(previewSpread);
  const caution = new Set(result?.caution ?? []);
  const blocked = new Set(result?.blocked ?? result?.danger ?? []);
  const edges = trailEdges(forest.id);
  const prompt = promptFor(step, zone, fireZones.length);
  const setScenario = (patch: Partial<ScenarioInputs>) => onScenarioChange({ ...scenario, ...patch });

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden rounded-xl shadow-panel" aria-label="Forest evacuation simulation map">
      <div className="absolute inset-0 origin-center will-change-transform" style={{ transform: zoomed ? `scale(${2.04 * zoom})` : "scale(1)", transformOrigin: zone ? ORIGIN[zone] : "50% 50%", transition: "transform 320ms var(--ease-out-smooth)" }}>
        <img src={forest.mapSrc} alt={`${forest.name} satellite map`} className="map-photo h-full w-full object-cover" />
        <ContourOverlay forestId={forest.id} />
        <div className="vignette pointer-events-none absolute inset-0" />
      </div>

      <div className="absolute top-3 left-3 z-30 rounded-md bg-danger/90 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-fg shadow-panel" role="note">
        Simulation only — call local emergency services for real emergencies.
      </div>

      {step === "forest" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="glass-panel rounded-2xl px-6 py-5 text-center shadow-panel"><p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">Step 1</p><p className="mt-1 font-display text-xl font-semibold">Choose a forest to begin</p><p className="mt-1 max-w-sm text-xs text-muted">Select a forest from the cards above, then choose your current zone.</p></div></div>}

      {step === "zone" && <div className="absolute inset-0 grid grid-cols-2 grid-rows-2" role="group" aria-label="Forest zones">
        {ZONES.map((z) => <button key={z.id} type="button" aria-label={`Choose ${z.label}`} onClick={() => onPickZone(z.id)} className="group relative min-h-11 border border-fg/10 bg-bg/10 transition-colors duration-200 hover:bg-primary/12"><span className="zone-label absolute inset-0 flex items-center justify-center text-2xl font-semibold text-fg/90 md:text-4xl">{z.label}</span><span className="absolute right-3 bottom-3 hidden text-[11px] tracking-wide text-fg/70 uppercase group-hover:block">Enter sector</span></button>)}
      </div>}

      {zoomed && gridOn && zone && <div className="absolute inset-0" style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))` }} role="grid" aria-label={`Zone ${zone} ${gridSize} by ${gridSize} grid`}>
        {Array.from({ length: cellCount }, (_, i) => {
          const isHere = current === i;
          const isFire = fireZones.includes(i);
          const isDanger = danger.has(i);
          const isPredicted = predicted.has(i) && !isFire;
          const isCaution = caution.has(i);
          const onPath = result?.path.includes(i);
          return <button key={i} type="button" role="gridcell" aria-label={`${cellLabel(zone, i)}${isHere ? ", current location" : ""}${isFire ? ", reported fire" : isPredicted ? ", predicted spread" : isCaution ? ", caution" : ""}`} aria-pressed={isFire} disabled={step === "route"} onClick={() => { if (step === "cell") onPickCell(i); else if (step === "fire") onToggleFire(i); }} className={cn("relative min-h-11 border border-fg/10 transition-all duration-200", step !== "route" && "hover:bg-fg/8", isDanger && "bg-danger/45", isPredicted && "bg-primary/25", isCaution && !isDanger && !isPredicted && "bg-caution/30", onPath && !isDanger && "bg-path/15", isHere && "ring-2 ring-primary ring-inset")}>
            <span className="absolute top-2 left-2 font-mono text-[11px] tracking-wider text-fg/80">{cellLabel(zone, i)}</span>
            {(step === "fire" || isFire || isPredicted) && !isHere && <span className="absolute inset-0 flex flex-col items-center justify-center gap-1">{isFire ? <FireGlyph hot /> : isPredicted ? <span className="size-4 rounded-full bg-primary ring-4 ring-primary/15" aria-hidden="true" /> : <FireGlyph />}{isFire && <span className="rounded bg-danger/75 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-fg uppercase">Reported fire</span>}{isPredicted && <span className="rounded bg-primary/75 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-primary-fg uppercase">Predicted</span>}</span>}
            {isHere && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold tracking-wider text-primary-fg uppercase">You</span>}
          </button>;
        })}
      </div>}

      {zoomed && gridOn && <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Trail network">
        {edges.map(([u, v]) => { const a = cellCenter(u, gridSize); const b = cellCenter(v, gridSize); const key = edgeKey(u, v); const closed = blocked.has(u) || blocked.has(v) || blockedTrails.includes(key); return <line key={key} className={closed ? "trail-line-blocked" : "trail-line"} x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100} vectorEffect="non-scaling-stroke" />; })}
        {result?.ok && pathPts && <polyline className="route-line route-line-new" points={pathPts} />}
      </svg>}

      {zoomed && gridOn && current !== null && <LocationPin index={current} gridSize={gridSize} />}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg/55 to-transparent" />
      <div className="absolute top-14 left-3 z-30 flex items-center gap-2">
        {step !== "zone" && <button type="button" aria-label="Go back one step" onClick={onBack} className="pointer-events-auto flex h-11 items-center gap-1.5 rounded-full bg-surface/80 px-3.5 text-sm font-medium shadow-panel backdrop-blur-md"><ChevronLeft className="size-4" /> Back</button>}
        <div className="pointer-events-none rounded-full bg-surface/80 px-3 py-2 text-xs text-fg shadow-panel backdrop-blur-md">{prompt}</div>
      </div>

      <div className="absolute top-14 right-3 z-30 flex flex-col gap-2">
        <MapBtn onClick={onReset} label="Reset simulation"><RotateCcw className="size-4" /></MapBtn>
        <MapBtn onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))} label="Zoom out" disabled={!zoomed || zoom <= 0.75}><Minus className="size-4" /></MapBtn>
        <MapBtn onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.25).toFixed(2))))} label="Zoom in" disabled={!zoomed || zoom >= 1.75}><Plus className="size-4" /></MapBtn>
      </div>

      <div className="absolute bottom-3 left-3 z-30 flex flex-col gap-2"><div className="rounded-md bg-surface/80 px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-muted shadow-panel backdrop-blur-md">{forest.region.toUpperCase()} · {forest.areaHa} HA · {gridSize}×{gridSize}</div>{step === "route" && <Legend />}</div>
      <div className="absolute right-3 bottom-3 z-30 flex items-end gap-2"><Compass /></div>

      {step === "cell" && zone && <Panel><p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">Step 3</p><p className="mt-1 font-display text-lg font-semibold">{current !== null ? `Current location: ${cellLabel(zone, current)}` : "Select your current grid section"}</p><p className="mt-1 text-xs text-muted">Choose the cell where you are standing.</p></Panel>}

      {step === "fire" && <div className="glass-panel absolute right-3 bottom-3 left-3 z-30 max-h-[58%] overflow-auto rounded-xl p-4 md:right-3 md:left-auto md:w-[430px]">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] tracking-[0.18em] text-danger uppercase">Step 4 · Scenario inputs</p><p className="mt-1 font-display text-lg font-semibold">{fireZones.length} reported fire zone{fireZones.length === 1 ? "" : "s"}</p></div><Flame className="size-6 text-danger" aria-hidden="true" /></div>
        <p className="mt-2 text-xs text-muted">Reported fires are blocked. The deterministic scenario risk model predicts spread for the selected time step and wind/slope inputs.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[10px] text-muted">Spread time<select value={scenario.spreadMinutes} onChange={(e) => setScenario({ spreadMinutes: Number(e.target.value) as ScenarioInputs["spreadMinutes"] })} className="mt-1 h-9 w-full rounded-md bg-elevated px-2 text-xs text-fg"><option value={0}>0 min</option><option value={10}>10 min</option><option value={20}>20 min</option><option value={30}>30 min</option></select></label>
          <label className="text-[10px] text-muted">Wind direction<select value={scenario.windDirection} onChange={(e) => setScenario({ windDirection: Number(e.target.value) as ScenarioInputs["windDirection"] })} className="mt-1 h-9 w-full rounded-md bg-elevated px-2 text-xs text-fg">{Object.entries(WIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-[10px] text-muted">Wind speed · {scenario.windSpeedKph} km/h<input aria-label="Wind speed in kilometers per hour" type="range" min="0" max="80" step="1" value={scenario.windSpeedKph} onChange={(e) => setScenario({ windSpeedKph: Number(e.target.value) })} className="mt-2 w-full" /></label>
          <label className="text-[10px] text-muted">Slope · {scenario.slopePercent}%<input aria-label="Slope percentage" type="range" min="0" max="100" step="1" value={scenario.slopePercent} onChange={(e) => setScenario({ slopePercent: Number(e.target.value) })} className="mt-2 w-full" /></label>
        </div>
        <div className="mt-3 rounded-lg bg-elevated/70 p-2 text-[10px] text-muted">Scenario risk is deterministic: reported fires + predicted spread + wind + slope. Rule-based simulation only; no trained models are used.</div>
        <div className="mt-3"><p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Block a trail</p><div className="mt-2 grid grid-cols-2 gap-1.5">{edges.map(([u, v]) => { const key = edgeKey(u, v); const active = blockedTrails.includes(key); return <button key={key} type="button" aria-label={`${active ? "Unblock" : "Block"} trail ${u + 1} to ${v + 1}`} aria-pressed={active} onClick={() => onToggleBlockedTrail(key)} className={cn("rounded-md border px-2 py-1.5 text-left text-[10px]", active ? "border-danger/60 bg-danger/20 text-danger" : "border-border bg-elevated text-muted hover:text-fg")}>Trail {u + 1} ↔ {v + 1}{active ? " · blocked" : ""}</button>; })}</div></div>
        <button type="button" disabled={busy || fireZones.length === 0} onClick={onConfirm} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg disabled:cursor-not-allowed disabled:opacity-45"><Navigation className="size-4" />{busy ? "Calculating safest route…" : "RECALCULATE SAFEST ROUTE"}</button>
      </div>}

      {step === "route" && result && <><RouteStatus result={result} zone={zone} current={current} /><RouteSheet result={result} zone={zone} onUpdateLocation={onUpdateLocation} /></>}
    </section>
  );
}

function promptFor(step: Step, zone: ZoneId | null, fireCount: number) {
  if (step === "forest") return "Step 1 · Choose a forest above";
  if (step === "zone") return "Step 2 · Tap a zone";
  if (step === "cell") return `Step 3 · Zone ${zone} · choose your section`;
  if (step === "fire") return `Step 4 · ${fireCount} reported fire zone${fireCount === 1 ? "" : "s"}`;
  return "Step 5 · Safest trail recalculated";
}

function FireGlyph({ hot }: { hot?: boolean }) { return <span className="relative flex size-10 items-center justify-center"><span className="fire-ring absolute size-10 rounded-full bg-danger/35" /><span className={cn("fire-mark relative flex size-8 items-center justify-center rounded-full", hot ? "bg-danger text-fg" : "bg-danger/80 text-fg")}><Flame className="size-4" strokeWidth={2} /></span></span>; }
function LocationPin({ index, gridSize }: { index: number; gridSize: number }) { const { x, y } = cellCenter(index, gridSize); return <div className="pin-float pointer-events-none absolute z-30" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}><MapPin className="size-8 fill-primary text-primary-fg drop-shadow-md" /></div>; }
function MapBtn({ children, onClick, label, disabled }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean }) { return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex size-11 items-center justify-center rounded-md bg-surface/80 text-fg shadow-panel backdrop-blur-md transition-transform duration-150 active:scale-[0.96] disabled:opacity-35">{children}</button>; }
function Compass() { return <div className="flex size-12 items-center justify-center rounded-full bg-surface/80 font-display text-[11px] font-semibold tracking-widest text-fg shadow-panel backdrop-blur-md" aria-label="North">N</div>; }
function Legend() { return <div className="flex flex-wrap gap-2 rounded-md bg-surface/80 px-2.5 py-2 text-[11px] shadow-panel backdrop-blur-md"><span>🟢 Path</span><span>🟠 Caution</span><span>🔴 Fire</span><span>• Predicted</span><span>⚫ Blocked trail</span></div>; }
function Panel({ children }: { children: ReactNode }) { return <div className="glass-panel absolute right-3 bottom-16 left-3 z-30 rounded-xl p-4 md:right-3 md:left-auto md:w-[380px]">{children}</div>; }

function useDraggablePanel(initial: { x: number; y: number }) {
  const [offset, setOffset] = useState(initial);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y }; };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; setOffset({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }); };
  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { const step = event.shiftKey ? 32 : 16; if (event.key === "ArrowLeft") setOffset((o) => ({ ...o, x: o.x - step })); if (event.key === "ArrowRight") setOffset((o) => ({ ...o, x: o.x + step })); if (event.key === "ArrowUp") setOffset((o) => ({ ...o, y: o.y - step })); if (event.key === "ArrowDown") setOffset((o) => ({ ...o, y: o.y + step })); };
  return { offset, onPointerDown, onPointerMove, stopDragging, onKeyDown };
}
function DragHandle({ label = "Move panel", ...handlers }: { label?: string; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void; onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void }) { return <div role="button" tabIndex={0} aria-label={label} aria-roledescription="draggable panel handle" title="Drag or use arrow keys to move this panel" onPointerDown={handlers.onPointerDown} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp} onPointerCancel={handlers.onPointerUp} onKeyDown={handlers.onKeyDown} className="absolute top-1/2 right-2 z-10 flex h-7 w-7 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-md bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg"><span aria-hidden="true" className="text-base leading-none tracking-[-0.18em]">⋮⋮</span></div>; }

function RouteStatus({ result, zone, current }: { result: EvacuateResult; zone: ZoneId | null; current: number | null }) {
  const currentLabel = zone && current !== null ? cellLabel(zone, current) : "—"; const drag = useDraggablePanel({ x: 0, y: 0 });
  return <div className="glass-panel z-20 w-[min(390px,calc(100%-1.5rem))] rounded-xl p-3.5" style={{ position: "absolute", top: "7rem", right: "0.75rem", transform: `translate(${drag.offset.x}px, ${drag.offset.y}px)` }}><DragHandle onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.stopDragging} onKeyDown={drag.onKeyDown} /><div className="flex items-center justify-between gap-3 pr-8"><div><p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">Evacuation status</p><p className="mt-1 text-sm font-semibold">{result.ok ? `Route recalculated from ${currentLabel}` : "No safe route"}</p></div><span className={cn("rounded-full px-2 py-1 text-[9px] font-bold tracking-wider uppercase", result.ok ? "bg-path/15 text-path" : "bg-danger/15 text-danger")}>{result.engine === "c-dijkstra" ? "C ENGINE" : "TS FALLBACK"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><StatusItem icon="🔥" label="Fire zones" value={String(result.fires.length)} /><StatusItem icon="⚠️" label="Risk" value={`${result.scenario_risk}/100`} /><StatusItem icon="📏" label="Distance" value={result.ok ? `${Math.round(result.distance_m)} m` : "—"} /><StatusItem icon="⚖️" label="Risk cost" value={result.ok ? `${Math.round(result.risk_cost)}` : "—"} /><StatusItem icon="⏱" label="Escape" value={result.ok ? `${Math.max(1, Math.round(result.eta_min))} min` : "—"} /><StatusItem icon="🧭" label="Spread" value={`${result.spread_minutes} min`} /></div><p className="mt-2 text-[10px] text-muted">{result.engine === "typescript-fallback" ? "Production is using the TypeScript fallback because the C engine is unavailable." : "Production C engine active."}</p></div>;
}
function StatusItem({ icon, label, value }: { icon: string; label: string; value: string }) { return <div className="rounded-lg bg-elevated/80 px-2.5 py-2"><p className="text-[9px] tracking-wide text-muted uppercase">{icon} {label}</p><p className="mt-0.5 truncate font-mono text-[11px] font-semibold tabular-nums">{value}</p></div>; }

function RouteSheet({ result, zone, onUpdateLocation }: { result: EvacuateResult; zone: ZoneId | null; onUpdateLocation: () => void }) {
  const drag = useDraggablePanel({ x: 0, y: 0 });
  if (!result.ok) return <div className="glass-panel z-20 w-[min(410px,calc(100%-1.5rem))] rounded-xl p-4" style={{ position: "absolute", left: "0.75rem", bottom: "0.75rem" }}><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 text-danger" /><div className="min-w-0 flex-1"><p className="font-display text-sm font-semibold">No safe trail from this position</p><p className="mt-1 text-sm text-muted">{result.error === "START_ON_FIRE" ? "Your selected position is marked as a fire zone." : "All available exits are blocked or unsafe. Update your position, fire report, or blocked trails and recalculate."}</p><button type="button" onClick={onUpdateLocation} className="mt-3 h-10 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-fg">UPDATE SCENARIO / RECALCULATE</button></div></div></div>;
  const labels = zone ? result.path.map((i) => cellLabel(zone, i)).join(" → ") : result.path.join(" → ");
  const meters = Math.round(result.distance_m); const mins = Math.max(1, Math.round(result.eta_min));
  return <div className="glass-panel z-20 w-[min(430px,calc(100%-1.5rem))] rounded-xl p-4" style={{ position: "absolute", left: "0.75rem", bottom: "0.75rem", transform: `translate(${drag.offset.x}px, ${drag.offset.y}px)` }}><DragHandle onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove} onPointerUp={drag.stopDragging} onKeyDown={drag.onKeyDown} /><div className="flex items-start justify-between gap-3 pr-8"><div><p className="text-[10px] tracking-[0.18em] text-primary uppercase">Active safest route</p><p className="font-display mt-1 text-lg leading-snug font-semibold">{labels} · Exit</p><p className="mt-1 text-[11px] font-medium text-path">Engine: {result.engine === "c-dijkstra" ? "C / Dijkstra" : "TypeScript fallback"}</p></div><span className="rounded-full bg-path/15 px-2 py-1 text-[9px] font-semibold tracking-wider text-path uppercase">Simulation</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat icon={<Navigation className="size-3.5" />} label="Distance" value={`${meters} m`} /><Stat icon={<Clock className="size-3.5" />} label="Escape" value={`${mins} min`} /><Stat icon={<Flame className="size-3.5" />} label="Fires" value={`${result.fires.length}`} /><Stat icon={<span>⚖️</span>} label="Risk cost" value={`${Math.round(result.risk_cost)}`} /></div><p className="mt-2 text-[10px] text-muted">Distance and ETA use real walked metres. Risk cost includes the caution multiplier. {result.scenario_summary}.</p><button type="button" onClick={onUpdateLocation} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 text-xs font-semibold text-fg hover:bg-primary/20"><RotateCcw className="size-4" /> UPDATE LOCATION / FIRE & RECALCULATE</button></div>;
}
function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-md bg-elevated px-2.5 py-2"><p className="flex items-center gap-1 text-[10px] tracking-wide text-muted uppercase">{icon}{label}</p><p className="mt-0.5 font-mono text-sm tabular-nums">{value}</p></div>; }
function ContourOverlay({ forestId }: { forestId: Forest["id"] }) { const rivers: Record<Forest["id"], string> = { miyawaki: "M 8 22 C 28 30, 40 48, 52 62 S 78 88, 94 70", anandvan: "M 12 40 C 30 28, 48 36, 62 52 S 78 70, 90 58", baner: "M 18 8 C 24 30, 36 48, 40 78 S 60 90, 88 86", tamhini: "M 4 48 C 28 42, 50 58, 70 50 S 88 38, 98 44" }; return <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={rivers[forestId]} fill="none" stroke="rgb(140 190 210 / 0.55)" strokeWidth="1.4" />{[22,38,54,70].map((ry) => <ellipse key={ry} cx="50" cy="50" rx={ry} ry={ry * 0.62} fill="none" stroke="rgb(232 238 233 / 0.12)" strokeWidth="0.4" />)}</svg>; }
