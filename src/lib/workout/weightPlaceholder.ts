// The hint in the weight field of the set form (#144): Bodyweight only where the exercise needs no load.
const UNLOADED = new Set(["body only", "foam roll"]);
// Bands and "other" (the dataset catch-all) and exercise ball (two weighted moves) may or may not be loaded.
const OPTIONAL_LOAD = new Set(["bands", "other", "exercise ball"]);

export function weightPlaceholder(equipment: string | null): string {
  if (equipment === null || UNLOADED.has(equipment)) return "Bodyweight";
  if (OPTIONAL_LOAD.has(equipment)) return "Optional kg";
  return "Load in kg";
}
