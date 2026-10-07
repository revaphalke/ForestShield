import assert from "node:assert/strict";
import { test } from "node:test";
import { computeEvacuation } from "./pathfinder.ts";

test("distance and ETA use real walked metres on a caution route", () => {
  const result = computeEvacuation({ forest: "miyawaki", zone: "A", from: 1, fires: [0], blockedTrails: ["1-2", "4-5", "4-7", "2-4"], scenario: { spreadMinutes: 0 } });
  assert.equal(result.ok, true);
  assert.ok(result.risk_cost > result.distance_m);
  assert.equal(result.distance_m, 240);
  assert.equal(result.eta_min, 3.48);
});

test("blocked trail is excluded from the selected path", () => {
  const result = computeEvacuation({ forest: "miyawaki", zone: "A", from: 4, fires: [8], blockedTrails: ["0-4", "2-4"] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.blocked_trails, ["0-4", "2-4"]);
  for (let i = 0; i + 1 < result.path.length; i += 1) assert.notDeepEqual([result.path[i], result.path[i + 1]].sort(), [0, 4]);
});

test("start on fire is rejected", () => {
  const result = computeEvacuation({ forest: "miyawaki", zone: "A", from: 4, fires: [4] });
  assert.equal(result.ok, false);
  assert.equal(result.error, "START_ON_FIRE");
});

test("all exits can be blocked through exit edges", () => {
  const result = computeEvacuation({ forest: "miyawaki", zone: "A", from: 4, fires: [8], blockedTrails: ["0-9", "2-9", "6-9", "8-9"] });
  assert.equal(result.ok, false);
  assert.equal(result.error, "NO_SAFE_PATH");
});
