import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { resetEngineProbe, runEvacuate } from "./engine.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; resetEngineProbe(); });

test("engine returns the C result directly when C succeeds", async () => {
  const cResult = { ok: true, engine: "c-dijkstra", forest: "miyawaki", zone: "A", from: 4, fires: [6], predicted_spread: [6], path: [4, 1, 0], path_len: 3, exit: 0, distance_m: 214, eta_min: 3.1, risk_cost: 310, danger: [6], caution: [3, 7], blocked: [6], blocked_trails: [], scenario_risk: 60, scenario_summary: "moderate scenario risk", spread_minutes: 0, wind_direction: 0, wind_speed_kph: 0, slope_percent: 0, error: "", algorithm: "Modified Dijkstra + BFS scenario spread" };
  globalThis.fetch = async (url) => new Response(url.toString().endsWith("/health") ? JSON.stringify({ ok: true }) : JSON.stringify(cResult), { status: 200, headers: { "content-type": "application/json" } });
  const result = await runEvacuate({ forest: "miyawaki", zone: "A", from: 4, fires: [6] });
  assert.equal(result.engine, "c-dijkstra");
  assert.equal(result.risk_cost, 310);
  assert.equal(result.distance_m, 214);
});

test("engine computes TypeScript result only when C is unavailable", async () => {
  globalThis.fetch = async () => { throw new Error("C offline"); };
  const result = await runEvacuate({ forest: "miyawaki", zone: "A", from: 4, fires: [6] });
  assert.equal(result.engine, "typescript-fallback");
  assert.equal(result.ok, true);
});
