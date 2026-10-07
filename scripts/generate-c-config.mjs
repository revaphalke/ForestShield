import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const sourcePath = join(root, "config", "forest-graph.json");
const outPath = join(root, "c", "graph_config.h");
const config = JSON.parse(readFileSync(sourcePath, "utf8"));

const esc = (s) => String(s).replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
const lines = [
  "#ifndef FORESTSHIELD_GRAPH_CONFIG_H",
  "#define FORESTSHIELD_GRAPH_CONFIG_H",
  "",
  "/* Generated from config/forest-graph.json. Do not edit by hand. */",
  `#define FS_CAUTION_MULT ${config.constants.cautionMultiplier}`,
  `#define FS_WALK_MPS ${config.constants.walkMps}`,
  `#define FS_SPREAD_CELLS_PER_10_MIN ${config.constants.spreadCellsPer10Min}`,
  `#define FS_WIND_BIAS_SCALE ${config.constants.windBiasScale}`,
  `#define FS_SLOPE_BIAS_SCALE ${config.constants.slopeBiasScale}`,
  `#define FS_MAX_GRID_SIZE ${Math.max(...Object.values(config.forests).map((f) => f.gridSize))}`,
  `#define FS_MAX_CELLS ${Math.max(...Object.values(config.forests).map((f) => f.gridSize * f.gridSize))}`,
  `#define FS_MAX_EDGES ${Math.max(...Object.values(config.forests).map((f) => f.edges.length))}`,
  `#define FS_MAX_BLOCKED_EDGES ${Math.max(...Object.values(config.forests).map((f) => f.edges.length)) + Math.max(...Object.values(config.forests).map((f) => f.gridSize * f.gridSize)) * 2}`,
  `#define FS_MAX_PQ ${Math.max(...Object.values(config.forests).map((f) => f.gridSize * f.gridSize)) * 8}`,
  "",
  "typedef struct { int u; int v; double weight; } FsRawEdge;",
  "typedef struct { int grid_size; int edge_count; const FsRawEdge *edges; int exit_count; const int *exits; const double *exit_weights; } FsForestConfig;",
  "",
];

for (const [id, forest] of Object.entries(config.forests)) {
  const n = esc(id);
  lines.push(`static const FsRawEdge FS_EDGES_${n}[] = {`);
  for (const [u, v, w] of forest.edges) lines.push(`  {${u}, ${v}, ${w}},`);
  lines.push("};");
  lines.push(`static const int FS_EXITS_${n}[] = {${forest.exits.join(", ")}};`);
  lines.push(`static const double FS_EXIT_WEIGHTS_${n}[] = {${forest.exits.map((e) => forest.exitWeights[String(e)] ?? 0).join(", ")}};`);
  lines.push("");
}

lines.push("static const FsForestConfig FS_FORESTS[] = {");
for (const [id, forest] of Object.entries(config.forests)) {
  const n = esc(id);
  lines.push(`  {${forest.gridSize}, ${forest.edges.length}, FS_EDGES_${n}, ${forest.exits.length}, FS_EXITS_${n}, FS_EXIT_WEIGHTS_${n}},`);
}
lines.push("};", "", "#endif", "");
writeFileSync(outPath, lines.join("\n"));
console.log(`Generated ${outPath}`);
