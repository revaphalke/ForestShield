import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStep, previousStep } from "./step-flow.ts";

test("five-step flow advances in order", () => {
  assert.equal(nextStep("forest"), "zone");
  assert.equal(nextStep("zone"), "cell");
  assert.equal(nextStep("cell"), "fire");
  assert.equal(nextStep("fire"), "route");
});

test("five-step flow backs out in order", () => {
  assert.equal(previousStep("route"), "fire");
  assert.equal(previousStep("fire"), "cell");
  assert.equal(previousStep("cell"), "zone");
  assert.equal(previousStep("zone"), "forest");
});
