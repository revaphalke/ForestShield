import graphConfig from "../../config/forest-graph.json" with { type: "json" };

export type ForestId = "miyawaki" | "anandvan" | "baner" | "tamhini";
export type ZoneId = "A" | "B" | "C" | "D";
export type GraphEdge = [number, number, number];
export type Forest = {
  id: ForestId;
  name: string;
  shortName: string;
  region: string;
  distanceKm: number;
  rating: number;
  areaHa: number;
  mapSrc: string;
  blurb: string;
};

export type ForestGraphConfig = {
  gridSize: number;
  edges: GraphEdge[];
  exits: number[];
  exitWeights: Record<string, number>;
  blockedTrails: string[];
};

export const FORESTS = [
  { id: "miyawaki", name: "Green Army Pune Miyawaki", shortName: "Miyawaki", region: "Baner–Balewadi, Pune", distanceKm: 2.4, rating: 4.8, areaHa: 1.6, mapSrc: "/maps/miyawaki.webp", blurb: "Dense native canopy on a restored urban plot. Tight trails, fast fuel load." },
  { id: "anandvan", name: "Anandvan Urban Forest", shortName: "Anandvan", region: "Hadapsar, Pune", distanceKm: 5.1, rating: 4.6, areaHa: 4.2, mapSrc: "/maps/anandvan.webp", blurb: "Lake-edge mixed woodland. River crossings add cost to north–south trails." },
  { id: "baner", name: "Baner Hills Reserve", shortName: "Baner Hills", region: "Baner Plateau, Pune", distanceKm: 8.3, rating: 4.7, areaHa: 12.8, mapSrc: "/maps/baner.webp", blurb: "Basalt ridges and switchbacks. North–south climbs are the slow legs." },
  { id: "tamhini", name: "Tamhini Ghat Canopy", shortName: "Tamhini", region: "Western Ghats, Pune", distanceKm: 62, rating: 4.9, areaHa: 86, mapSrc: "/maps/tamhini.webp", blurb: "Unbroken ghat rainforest. A monsoon river cuts the mid-grid east–west." },
] satisfies Forest[];

export const ZONES: { id: ZoneId; label: string; origin: string }[] = [
  { id: "A", label: "Zone A", origin: "0% 0%" },
  { id: "B", label: "Zone B", origin: "100% 0%" },
  { id: "C", label: "Zone C", origin: "0% 100%" },
  { id: "D", label: "Zone D", origin: "100% 100%" },
];

export function getGraphConfig(forest: ForestId): ForestGraphConfig {
  return graphConfig.forests[forest] as unknown as ForestGraphConfig;
}

export function cellLabel(zone: ZoneId, index: number): string {
  return `${zone}${index + 1}`;
}

export function cellCenter(index: number, gridSize = 3): { x: number; y: number } {
  const r = Math.floor(index / gridSize);
  const c = index % gridSize;
  return { x: (c + 0.5) / gridSize, y: (r + 0.5) / gridSize };
}
