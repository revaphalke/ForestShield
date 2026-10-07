/* TypeScript evacuation engine and deterministic fallback. */
import graphConfig from "../../config/forest-graph.json" with { type: "json" };
import { cellCenter, getGraphConfig, type ForestId } from "./forests.ts";
import { computeScenarioRisk, predictFireSpread, type ScenarioInputs } from "./risk-model.ts";

export const CAUTION_MULT = graphConfig.constants.cautionMultiplier;
export const WALK_MPS = graphConfig.constants.walkMps;
const INF = 1e12;

type Edge = { to: number; weight: number };
export type TrailEdge = [number, number];
export type EvacuateInput = {
  forest: ForestId;
  zone: string;
  from: number;
  fires: number[];
  blockedTrails?: string[];
  scenario?: Partial<ScenarioInputs>;
};

export type EvacuateResult = {
  ok: boolean;
  engine: "typescript-fallback" | "c-dijkstra" | string;
  forest: string;
  zone: string;
  from: number;
  fires: number[];
  predicted_spread: number[];
  path: number[];
  path_len: number;
  exit: number;
  distance_m: number;
  eta_min: number;
  risk_cost: number;
  danger: number[];
  caution: number[];
  blocked: number[];
  blocked_trails: string[];
  scenario_risk: number;
  scenario_summary: string;
  spread_minutes: number;
  wind_direction: number;
  wind_speed_kph: number;
  slope_percent: number;
  error: string;
  algorithm: string;
};

export const DEFAULT_SCENARIO: ScenarioInputs = {
  windDirection: 0,
  windSpeedKph: 0,
  slopePercent: 0,
  spreadMinutes: 0,
};

export function edgeKey(u: number, v: number): string {
  return `${Math.min(u, v)}-${Math.max(u, v)}`;
}

function neighbors4(idx: number, gridSize: number): number[] {
  const r = Math.floor(idx / gridSize);
  const c = idx % gridSize;
  const out: number[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < gridSize && cc >= 0 && cc < gridSize) out.push(rr * gridSize + cc);
  }
  return out;
}

export function bfsExpandFires(fires: number[], start: number, gridSize: number) {
  const cellCount = gridSize * gridSize;
  const blocked = new Set(fires.filter((fire) => fire >= 0 && fire < cellCount));
  const caution = new Set<number>();
  for (const fire of blocked) {
    for (const next of neighbors4(fire, gridSize)) {
      if (!blocked.has(next)) caution.add(next);
    }
  }
  caution.delete(start);
  return {
    danger: [...blocked].sort((a, b) => a - b),
    caution: [...caution].sort((a, b) => a - b),
  };
}

class MinHeap {
  private items: Array<{ node: number; dist: number }> = [];
  get size() { return this.items.length; }
  push(node: number, dist: number) {
    const a = this.items;
    a.push({ node, dist });
    let i = a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (a[p].dist < a[i].dist || (a[p].dist === a[i].dist && a[p].node <= a[i].node)) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (!a.length || !last) return top;
    a[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let s = i;
      const less = (x: number, y: number) => a[x].dist < a[y].dist || (a[x].dist === a[y].dist && a[x].node < a[y].node);
      if (l < a.length && less(l, s)) s = l;
      if (r < a.length && less(r, s)) s = r;
      if (s === i) break;
      [a[s], a[i]] = [a[i], a[s]];
      i = s;
    }
    return top;
  }
}

function buildGraph(forest: ForestId, blockedTrails: Set<string>) {
  const config = getGraphConfig(forest);
  const exitNode = config.gridSize * config.gridSize;
  const adj: Edge[][] = Array.from({ length: exitNode + 1 }, () => []);
  const add = (u: number, v: number, weight: number) => {
    adj[u].push({ to: v, weight });
    adj[v].push({ to: u, weight });
  };
  for (const [u, v, weight] of config.edges) {
    if (!blockedTrails.has(edgeKey(u, v))) add(u, v, weight);
  }
  config.exits.forEach((cell) => {
    const weight = config.exitWeights[String(cell)] ?? 0;
    if (weight > 0 && !blockedTrails.has(edgeKey(cell, exitNode))) add(cell, exitNode, weight);
  });
  return { adj, exitNode };
}

function dijkstra(
  adj: Edge[][],
  src: number,
  exitNode: number,
  blocked: Set<number>,
  caution: Set<number>,
) {
  const dist = new Array<number>(adj.length).fill(INF);
  const prev = new Array<number>(adj.length).fill(-1);
  const pq = new MinHeap();
  dist[src] = 0;
  pq.push(src, 0);
  while (pq.size) {
    const item = pq.pop();
    if (item.dist > dist[item.node] + 1e-9) continue;
    for (const edge of adj[item.node]) {
      const v = edge.to;
      if (v !== src && blocked.has(v)) continue;
      const riskWeight = caution.has(item.node) || caution.has(v) ? edge.weight * CAUTION_MULT : edge.weight;
      const next = dist[item.node] + riskWeight;
      if (next + 1e-12 < dist[v]) {
        dist[v] = next;
        prev[v] = item.node;
        pq.push(v, next);
      }
    }
  }
  return { dist, prev, reachable: dist[exitNode] < INF / 2 };
}

function reconstruct(prev: number[], src: number, exitNode: number): number[] {
  const tmp: number[] = [];
  let cur = exitNode;
  while (cur !== -1 && tmp.length <= prev.length) {
    tmp.push(cur);
    if (cur === src) break;
    cur = prev[cur];
  }
  if (tmp.at(-1) !== src) return [];
  return tmp.reverse().filter((node) => node !== exitNode);
}

function realDistance(path: number[], exitNode: number, forest: ForestId): number {
  const config = getGraphConfig(forest);
  let total = 0;
  for (let i = 0; i + 1 < path.length; i += 1) {
    const edge = config.edges.find(([u, v]) => edgeKey(u, v) === edgeKey(path[i], path[i + 1]));
    if (!edge) return 0;
    total += edge[2];
  }
  const exitCell = path.at(-1);
  if (exitCell !== undefined) total += config.exitWeights[String(exitCell)] ?? 0;
  void exitNode;
  return total;
}

function normalizeScenario(scenario?: Partial<ScenarioInputs>): ScenarioInputs {
  const spread = [0, 10, 20, 30].includes(Number(scenario?.spreadMinutes))
    ? Number(scenario?.spreadMinutes)
    : 0;
  const directions = [0, 45, 90, 135, 180, 225, 270, 315];
  const direction = directions.includes(Number(scenario?.windDirection)) ? Number(scenario?.windDirection) : 0;
  return {
    spreadMinutes: spread as ScenarioInputs["spreadMinutes"],
    windDirection: direction as ScenarioInputs["windDirection"],
    windSpeedKph: Math.max(0, Math.min(100, Number(scenario?.windSpeedKph ?? 0))),
    slopePercent: Math.max(0, Math.min(100, Number(scenario?.slopePercent ?? 0))),
  };
}

export function computeEvacuation(input: EvacuateInput): EvacuateResult {
  const config = getGraphConfig(input.forest);
  const cellCount = config.gridSize * config.gridSize;
  const fires = [...new Set(input.fires)].filter((i) => i >= 0 && i < cellCount).sort((a, b) => a - b);
  const scenario = normalizeScenario(input.scenario);
  const predictedSpread = predictFireSpread(input.forest, fires, scenario);
  const risk = computeScenarioRisk(fires, scenario, predictedSpread);
  const blockedTrails = [...new Set([...config.blockedTrails, ...(input.blockedTrails ?? [])].map((value) => {
    const [a, b] = value.split("-").map(Number);
    return Number.isInteger(a) && Number.isInteger(b) ? edgeKey(a, b) : "";
  }).filter(Boolean))].sort();
  const base: EvacuateResult = {
    ok: false,
    engine: "typescript-fallback",
    forest: input.forest,
    zone: input.zone,
    from: input.from,
    fires,
    predicted_spread: predictedSpread,
    path: [],
    path_len: 0,
    exit: -1,
    distance_m: 0,
    eta_min: 0,
    risk_cost: 0,
    danger: predictedSpread,
    caution: [],
    blocked: predictedSpread,
    blocked_trails: blockedTrails,
    scenario_risk: risk.score,
    scenario_summary: risk.summary,
    spread_minutes: scenario.spreadMinutes,
    wind_direction: scenario.windDirection,
    wind_speed_kph: scenario.windSpeedKph,
    slope_percent: scenario.slopePercent,
    error: "",
    algorithm: "Modified Dijkstra + BFS scenario spread",
  };

  if (input.from < 0 || input.from >= cellCount || !fires.length) {
    return { ...base, error: !fires.length ? "NO_FIRE_ZONES" : "INVALID_CELL" };
  }
  if (fires.includes(input.from)) return { ...base, error: "START_ON_FIRE" };
  const blocked = new Set(predictedSpread);
  const expansion = bfsExpandFires(predictedSpread, input.from, config.gridSize);
  const caution = new Set(expansion.caution);
  const { adj, exitNode } = buildGraph(input.forest, new Set(blockedTrails));
  const route = dijkstra(adj, input.from, exitNode, blocked, caution);
  if (!route.reachable) return { ...base, caution: expansion.caution, error: "NO_SAFE_PATH" };
  const path = reconstruct(route.prev, input.from, exitNode);
  if (!path.length) return { ...base, caution: expansion.caution, error: "NO_SAFE_PATH" };
  const distance = realDistance(path, exitNode, input.forest);
  return {
    ...base,
    ok: true,
    path,
    path_len: path.length,
    exit: path.at(-1) ?? -1,
    distance_m: Math.round(distance * 10) / 10,
    eta_min: Math.round((distance / WALK_MPS / 60) * 100) / 100,
    risk_cost: Math.round(route.dist[exitNode] * 10) / 10,
    caution: expansion.caution,
  };
}

export function trailEdges(forest: ForestId): TrailEdge[] {
  return getGraphConfig(forest).edges.map(([u, v]) => [u, v]);
}

export function getGridSize(forest: ForestId): number {
  return getGraphConfig(forest).gridSize;
}

export function trailPoint(index: number, forest: ForestId) {
  return cellCenter(index, getGridSize(forest));
}
