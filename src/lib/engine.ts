import {
  computeEvacuation,
  type EvacuateInput,
  type EvacuateResult,
} from "./pathfinder.ts";

let cAvailable: boolean | null = null;

export function cEngineUrl(): string {
  return (((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_C_ENGINE_URL)?.trim().replace(/\/$/, "")) || "/c-api";
}

export function resetEngineProbe() {
  cAvailable = null;
}

async function probeC(): Promise<boolean> {
  if (cAvailable !== null) return cAvailable;
  try {
    const response = await fetch(`${cEngineUrl()}/health`, { signal: AbortSignal.timeout(500) });
    cAvailable = response.ok;
  } catch {
    cAvailable = false;
  }
  return cAvailable;
}

function requestPayload(input: EvacuateInput) {
  return {
    forest: input.forest,
    zone: input.zone,
    from: input.from,
    fires: input.fires,
    blocked_trails: input.blockedTrails ?? [],
    spread_minutes: input.scenario?.spreadMinutes ?? 0,
    wind_direction: input.scenario?.windDirection ?? 0,
    wind_speed_kph: input.scenario?.windSpeedKph ?? 0,
    slope_percent: input.scenario?.slopePercent ?? 0,
  };
}

export async function runEvacuate(input: EvacuateInput): Promise<EvacuateResult> {
  if (await probeC()) {
    try {
      const response = await fetch(`${cEngineUrl()}/api/evacuate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload(input)),
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        const data = (await response.json()) as EvacuateResult;
        if (typeof data?.ok === "boolean" && typeof data?.engine === "string") return data;
      }
    } catch {
      // Fall through to the deterministic TypeScript implementation.
    }
    cAvailable = false;
  }

  return computeEvacuation(input);
}
