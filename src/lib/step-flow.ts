export type AppStep = "forest" | "zone" | "cell" | "fire" | "route";

export function nextStep(step: AppStep): AppStep {
  if (step === "forest") return "zone";
  if (step === "zone") return "cell";
  if (step === "cell") return "fire";
  if (step === "fire") return "route";
  return "route";
}

export function previousStep(step: AppStep): AppStep {
  if (step === "route") return "fire";
  if (step === "fire") return "cell";
  if (step === "cell") return "zone";
  if (step === "zone") return "forest";
  return "forest";
}
