// The hint in the weight field of the set form (#144): Bodyweight only where the exercise needs no load.
const UNLOADED = new Set(["body only", "foam roll", "exercise ball"]);
// Bands and "other" (the dataset's catch-all) may or may not be loaded.
const OPTIONAL_LOAD = new Set(["bands", "other"]);

export function weightPlaceholder(equipment: string | null): string {
  if (equipment === null || UNLOADED.has(equipment)) return "Bodyweight";
  if (OPTIONAL_LOAD.has(equipment)) return "Load in kg (optional)";
  return "Load in kg";
}
