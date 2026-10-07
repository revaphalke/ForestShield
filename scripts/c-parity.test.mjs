import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const bin = join(root, "c", process.platform === "win32" ? "forestshield.exe" : "forestshield");
function ensureBinary() {
  if (existsSync(bin)) return true;
  const make = spawnSync("make", ["-C", "c"], { cwd: root, encoding: "utf8" });
  if (make.status !== 0) return false;
  return existsSync(bin);
}

test("C and TypeScript engines stay in parity", async (t) => {
  if (!ensureBinary()) { t.skip("C compiler/make unavailable in this environment"); return; }
  const { computeEvacuation } = await import("../src/lib/pathfinder.ts");
  const fixtures = [
    { forest: "miyawaki", from: 4, fires: [6] },
    { forest: "anandvan", from: 1, fires: [7], scenario: { spreadMinutes: 20, windDirection: 90, windSpeedKph: 30, slopePercent: 10 } },
    { forest: "baner", from: 0, fires: [8], blockedTrails: ["0-4"] },
  ];
  for (const input of fixtures) {
    const args = ["evacuate", input.forest, `A${input.from + 1}`, ...input.fires.map((cell) => `A${cell + 1}`)];
    if (input.scenario?.spreadMinutes) args.push("--spread", String(input.scenario.spreadMinutes), "--wind-direction", String(input.scenario.windDirection), "--wind-speed", String(input.scenario.windSpeedKph), "--slope", String(input.scenario.slopePercent));
    if (input.blockedTrails) args.push("--blocked", input.blockedTrails.join(","));
    const raw = execFileSync(bin, args, { cwd: root, encoding: "utf8" });
    const c = JSON.parse(raw);
    const ts = computeEvacuation({ ...input, zone: "A" });
    assert.equal(c.ok, ts.ok, `${input.forest} ok mismatch`);
    assert.deepEqual(c.path, ts.path, `${input.forest} path mismatch`);
    assert.equal(c.distance_m, ts.distance_m, `${input.forest} distance mismatch`);
    assert.equal(c.eta_min, ts.eta_min, `${input.forest} eta mismatch`);
    assert.equal(c.risk_cost, ts.risk_cost, `${input.forest} risk cost mismatch`);
    assert.equal(c.scenario_risk, ts.scenario_risk, `${input.forest} scenario risk mismatch`);
    assert.deepEqual(c.predicted_spread, ts.predicted_spread, `${input.forest} spread mismatch`);
  }
});
