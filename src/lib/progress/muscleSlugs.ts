// Our 17 library muscle names (free-exercise-db) mapped to the body regions drawn by
// react-muscle-highlighter. Swapping the diagram later only means changing this file.
import type { Slug } from "react-muscle-highlighter";

export const MUSCLE_SLUGS: Record<string, Slug> = {
  abdominals: "abs",
  // The diagram has no abductor region; most abduction work is the outer glutes
  // (gluteus medius and minimus), so it is shown there. An approximation.
  abductors: "gluteal",
  adductors: "adductors",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearm",
  glutes: "gluteal",
  hamstrings: "hamstring",
  // The diagram draws one upper-back region for both.
  lats: "upper-back",
  "middle back": "upper-back",
  "lower back": "lower-back",
  neck: "neck",
  quadriceps: "quadriceps",
  shoulders: "deltoids",
  traps: "trapezius",
  triceps: "triceps",
};

// The diagram regions for a list of muscles, without duplicates.
export function slugsFor(muscles: string[]): Slug[] {
  const slugs = new Set<Slug>();
  for (const muscle of muscles) {
    const slug = MUSCLE_SLUGS[muscle];
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}
