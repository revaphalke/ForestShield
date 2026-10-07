import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
test("generated C graph header matches the shared JSON source", () => {
  execFileSync(process.execPath, [join(root, "scripts/generate-c-config.mjs")], { stdio: "ignore" });
  const header = readFileSync(join(root, "c/graph_config.h"), "utf8");
  assert.match(header, /FS_EDGES_MIYAWAKI/);
  assert.match(header, /FS_EDGES_TAMHINI/);
  assert.match(header, /FS_CAUTION_MULT 2\.8/);
});
