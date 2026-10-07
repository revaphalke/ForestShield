import graphConfig from "../../config/forest-graph.json" with { type: "json" };
import { getGraphConfig, type ForestId } from "./forests.ts";

export type WindDirection = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
export type SpreadMinutes = 0 | 10 | 20 | 30;

export type ScenarioInputs = {
  windDirection: WindDirection;
  windSpeedKph: number;
  slopePercent: number;
  spreadMinutes: SpreadMinutes;
};

export type ScenarioRisk = {
  score: number;
  predictedSpread: number[];
  steps: number;
  summary: string;
};

function neighbors(index: number, gridSize: number): number[] {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const out: number[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) out.push(r * gridSize + c);
  }
  return out;
}

function windVector(degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [Math.sin(radians), -Math.cos(radians)];
}

function directionScore(source: number, target: number, gridSize: number, windDirection: number, windSpeedKph: number, slopePercent: number) {
  const sr = Math.floor(source / gridSize);
  const sc = source % gridSize;
  const tr = Math.floor(target / gridSize);
  const tc = target % gridSize;
  const dx = tc - sc;
  const dy = tr - sr;
  const [wx, wy] = windVector(windDirection);
  const alignment = Math.max(0, Math.min(1, dx * wx + dy * wy));
  const windBias = alignment * (Math.max(0, windSpeedKph) / 20) * 0.75;
  const slopeBias = (Math.max(0, slopePercent) / 100) * 0.35;
  return 1 + windBias + slopeBias;
}

export function predictFireSpread(
  forest: ForestId,
  fires: number[],
  inputs: ScenarioInputs,
): number[] {
  const gridSize = getGraphConfig(forest).gridSize;
  const cellCount = gridSize * gridSize;
  const steps = Math.max(0, Math.min(3, Math.floor(inputs.spreadMinutes / 10)));
  const predicted = new Set(fires.filter((cell) => cell >= 0 && cell < cellCount));
  let frontier = [...predicted];

  for (let step = 0; step < steps && frontier.length; step += 1) {
    const candidates = new Map<number, number>();
    for (const source of frontier) {
      for (const target of neighbors(source, gridSize)) {
        if (predicted.has(target)) continue;
        const score = directionScore(
          source,
          target,
          gridSize,
          inputs.windDirection,
          inputs.windSpeedKph,
          inputs.slopePercent,
        );
        candidates.set(target, Math.max(candidates.get(target) ?? 0, score));
      }
    }
    const capacity = Math.min(
      cellCount - predicted.size,
      Math.max(1, Math.round(graphConfig.constants.spreadCellsPer10Min + Math.max(0, inputs.windSpeedKph) / 20 + Math.max(0, inputs.slopePercent) / 50)),
    );
    const next = [...candidates.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, capacity)
      .map(([cell]) => cell);
    for (const cell of next) predicted.add(cell);
    frontier = next;
  }

  return [...predicted].sort((a, b) => a - b);
}

export function computeScenarioRisk(fires: number[], inputs: ScenarioInputs, predictedSpread: number[]): ScenarioRisk {
  const score = Math.min(
    100,
    Math.round(
      20 + fires.length * 18 + Math.max(0, predictedSpread.length - fires.length) * 8 + Math.max(0, inputs.windSpeedKph) * 0.55 + Math.max(0, inputs.slopePercent) * 0.2,
    ),
  );
  const level = score >= 75 ? "high" : score >= 45 ? "moderate" : "low";
  return {
    score,
    predictedSpread,
    steps: Math.floor(inputs.spreadMinutes / 10),
    summary: `${level} scenario risk · ${predictedSpread.length} predicted fire cell${predictedSpread.length === 1 ? "" : "s"}`,
  };
}
