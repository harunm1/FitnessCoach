// The hint in the weight field of the set form (#144): Bodyweight only where the exercise needs no equipment.
export function weightPlaceholder(equipment: string | null): string {
  return equipment === null || equipment === "body only"
    ? "Bodyweight"
    : "Load in kg";
}
