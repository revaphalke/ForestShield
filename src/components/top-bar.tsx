import { ChevronDown, Search, Shield, Star } from "lucide-react";
import { FORESTS, type Forest, type ForestId } from "@/lib/forests";
import { cn } from "@/lib/utils";

type Props = {
  forest: Forest;
  query: string;
  onQuery: (v: string) => void;
  onSelect: (id: ForestId) => void;
  stepLabel: string;
  engineLabel: string;
};

export function TopBar({
  forest,
  query,
  onQuery,
  onSelect,
  stepLabel,
  engineLabel,
}: Props) {
  const filtered = FORESTS.filter((f) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) ||
      f.region.toLowerCase().includes(q) ||
      f.shortName.toLowerCase().includes(q)
    );
  });

  return (
    <header className="glass-panel relative flex h-[20%] min-h-[148px] max-h-[210px] flex-col overflow-hidden rounded-xl md:min-h-[168px]">
      <div className="accent-line h-0.5 w-full shrink-0" />

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2.5 md:px-4">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Shield className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[15px] leading-tight font-semibold tracking-tight md:text-base">
                ForestShield
              </p>
              <p className="truncate text-[11px] text-muted">{stepLabel}</p>
            </div>
          </div>

          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search forests"
              className="h-10 w-full rounded-md bg-elevated pr-3 pl-9 text-sm text-fg shadow-panel outline-none placeholder:text-faint focus:shadow-panel-hover"
            />
          </label>

          <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-[10px] tracking-wide text-muted uppercase md:flex">
            <span className="size-1.5 rounded-full bg-primary" />
            {engineLabel}
          </div>
        </div>

        <div className="flex min-h-0 items-stretch gap-2">
          <label className="relative hidden shrink-0 sm:block">
            <span className="sr-only">Select forest</span>
            <select
              value={forest.id}
              onChange={(e) => onSelect(e.target.value as ForestId)}
              className="h-full min-w-[11.5rem] appearance-none rounded-lg bg-elevated py-2 pr-8 pl-3 text-sm font-medium text-fg shadow-panel outline-none"
            >
              {FORESTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.shortName}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
          </label>

          <div className="card-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {(filtered.length ? filtered : FORESTS).map((f) => (
              <ForestCard
                key={f.id}
                forest={f}
                active={f.id === forest.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function ForestCard({
  forest,
  active,
  onSelect,
}: {
  forest: Forest;
  active: boolean;
  onSelect: (id: ForestId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(forest.id)}
      className={cn(
        "flex h-[72px] w-[200px] shrink-0 items-center gap-2.5 rounded-lg p-1.5 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out active:scale-[0.96] md:w-auto md:min-w-0 md:flex-1",
        active ? "bg-elevated shadow-panel-hover ring-1 ring-primary/50" : "bg-surface-2/80 shadow-panel hover:shadow-panel-hover",
      )}
    >
      <img
        src={forest.mapSrc}
        alt=""
        className="size-[60px] rounded-md object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-tight font-medium">
          {forest.shortName}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
          <span className="tabular-nums">{forest.distanceKm} km</span>
          <span className="flex items-center gap-0.5 text-fg">
            <Star className="size-2.5 fill-primary text-primary" />
            <span className="tabular-nums">{forest.rating.toFixed(1)}</span>
          </span>
        </span>
      </span>
    </button>
  );
}
