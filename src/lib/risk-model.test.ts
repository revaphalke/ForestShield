import assert from "node:assert/strict";
import { test } from "node:test";
import { computeScenarioRisk, predictFireSpread } from "./risk-model.ts";

test("zero-minute spread leaves only reported fire cells", () => {
  assert.deepEqual(predictFireSpread("miyawaki", [4], { spreadMinutes: 0, windDirection: 0, windSpeedKph: 0, slopePercent: 0 }), [4]);
});

test("BFS spread grows with the selected time step", () => {
  const ten = predictFireSpread("miyawaki", [4], { spreadMinutes: 10, windDirection: 0, windSpeedKph: 0, slopePercent: 0 });
  const thirty = predictFireSpread("miyawaki", [4], { spreadMinutes: 30, windDirection: 0, windSpeedKph: 0, slopePercent: 0 });
  assert.ok(ten.length > 1);
  assert.ok(thirty.length > ten.length);
});

test("wind changes deterministic candidate ordering", () => {
  const north = predictFireSpread("miyawaki", [4], { spreadMinutes: 10, windDirection: 0, windSpeedKph: 20, slopePercent: 0 });
  const south = predictFireSpread("miyawaki", [4], { spreadMinutes: 10, windDirection: 180, windSpeedKph: 20, slopePercent: 0 });
  assert.notDeepEqual(north, south);
});

test("scenario risk is transparent and bounded", () => {
  const spread = [4, 1, 3];
  const risk = computeScenarioRisk([4], { spreadMinutes: 20, windDirection: 90, windSpeedKph: 30, slopePercent: 20 }, spread);
  assert.ok(risk.score >= 0 && risk.score <= 100);
  assert.match(risk.summary, /scenario risk/);
});
