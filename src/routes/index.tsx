import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ForestMap, type Step } from "@/components/forest-map";
import { TopBar } from "@/components/top-bar";
import { runEvacuate } from "@/lib/engine";
import { FORESTS, type ForestId, type ZoneId } from "@/lib/forests";
import type { EvacuateResult } from "@/lib/pathfinder";
import type { ScenarioInputs, SpreadMinutes, WindDirection } from "@/lib/risk-model";

export const Route = createFileRoute("/")({ component: Home });

const DEFAULT_SCENARIO: ScenarioInputs = { windDirection: 0, windSpeedKph: 0, slopePercent: 0, spreadMinutes: 0 };

function Home() {
  const [forestId, setForestId] = useState<ForestId>("miyawaki");
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<Step>("forest");
  const [zone, setZone] = useState<ZoneId | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [fireZones, setFireZones] = useState<number[]>([]);
  const [blockedTrails, setBlockedTrails] = useState<string[]>([]);
  const [scenario, setScenario] = useState<ScenarioInputs>(DEFAULT_SCENARIO);
  const [result, setResult] = useState<EvacuateResult | null>(null);
  const [busy, setBusy] = useState(false);

  const forest = useMemo(() => FORESTS.find((f) => f.id === forestId) ?? FORESTS[0], [forestId]);
  const engineHint = result ? (result.engine === "c-dijkstra" ? "C / Dijkstra" : "TypeScript fallback") : "Engine ready";

  function selectForest(id: ForestId) {
    setForestId(id); setZone(null); setCurrent(null); setFireZones([]); setBlockedTrails([]); setResult(null); setScenario(DEFAULT_SCENARIO); setStep("zone");
  }
  function pickZone(z: ZoneId) { setZone(z); setCurrent(null); setFireZones([]); setBlockedTrails([]); setResult(null); setStep("cell"); }
  function pickCell(i: number) { setCurrent(i); setResult(null); setStep("fire"); }
  function updateCurrentLocation() { setResult(null); setStep("cell"); }
  function toggleFireZone(i: number) {
    if (current === i) return;
    setFireZones((prev) => prev.includes(i) ? prev.filter((cell) => cell !== i) : [...prev, i]);
  }
  function toggleBlockedTrail(edge: string) {
    setBlockedTrails((prev) => prev.includes(edge) ? prev.filter((item) => item !== edge) : [...prev, edge]);
  }
  async function recalculateRoute() {
    if (current === null || !zone || fireZones.length === 0) return;
    setBusy(true);
    try {
      const r = await runEvacuate({ forest: forest.id, zone, from: current, fires: fireZones, blockedTrails, scenario });
      setResult(r); setStep("route");
    } finally { setBusy(false); }
  }
  function back() {
    if (step === "forest") return;
    if (step === "route") { updateCurrentLocation(); return; }
    if (step === "fire") { setStep("cell"); return; }
    if (step === "cell") { setZone(null); setCurrent(null); setFireZones([]); setBlockedTrails([]); setResult(null); setStep("zone"); return; }
    setZone(null); setCurrent(null); setFireZones([]); setBlockedTrails([]); setResult(null); setStep("forest");
  }
  function reset() {
    setStep("forest"); setZone(null); setCurrent(null); setFireZones([]); setBlockedTrails([]); setResult(null); setScenario(DEFAULT_SCENARIO); setBusy(false);
  }

  return (
    <main className="flex h-dvh flex-col gap-2 overflow-hidden bg-bg p-2 md:p-3">
      <TopBar forest={forest} query={query} onQuery={setQuery} onSelect={selectForest} stepLabel={labelFor(step, zone)} engineLabel={engineHint} />
      <ForestMap
        forest={forest} step={step} zone={zone} current={current} fireZones={fireZones} blockedTrails={blockedTrails}
        scenario={scenario} result={result} busy={busy} onPickZone={pickZone} onPickCell={pickCell} onToggleFire={toggleFireZone}
        onToggleBlockedTrail={toggleBlockedTrail} onScenarioChange={setScenario} onConfirm={recalculateRoute}
        onUpdateLocation={updateCurrentLocation} onBack={back} onReset={reset}
      />
    </main>
  );
}

export function labelFor(step: Step, zone: ZoneId | null) {
  switch (step) {
    case "forest": return "Step 1 — Choose a forest";
    case "zone": return "Step 2 — Choose current zone";
    case "cell": return `Step 3 — Zone ${zone} grid`;
    case "fire": return "Step 4 — Report fire + scenario";
    case "route": return "Step 5 — Dynamic safe evacuation path";
  }
}

export const SCENARIO_OPTIONS = {
  spreadMinutes: [0, 10, 20, 30] as SpreadMinutes[],
  windDirections: [0, 45, 90, 135, 180, 225, 270, 315] as WindDirection[],
};
