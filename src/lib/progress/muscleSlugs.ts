// Our 17 library muscle names (free-exercise-db) mapped to the body regions drawn by
// react-muscle-highlighter. Swapping the diagram later only means changing this file.
import type { Slug } from "react-muscle-highlighter";
import type { MuscleShare } from "./muscles";

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

// What each muscle region is called in the hover label.
const REGION_NAMES: Partial<Record<Slug, string>> = {
  abs: "Abs",
  adductors: "Adductors",
  biceps: "Biceps",
  calves: "Calves",
  chest: "Chest",
  deltoids: "Shoulders",
  forearm: "Forearms",
  gluteal: "Glutes",
  hamstring: "Hamstrings",
  "lower-back": "Lower back",
  neck: "Neck",
  quadriceps: "Quadriceps",
  trapezius: "Traps",
  triceps: "Triceps",
  "upper-back": "Upper back",
};

// The hover label for each muscle region, from the same numbers as the muscle
// list: "Chest · 2 of 3 workouts (67%)". A region drawn for two of our muscles
// names each one. Regions that aren't muscles (head, hands, feet) get none.
export function regionLabels(
  shares: MuscleShare[],
  workouts: number,
  period: string, // "November 2026"
): Partial<Record<Slug, string>> {
  const byMuscle = new Map(shares.map((share) => [share.muscle, share]));
  const percent = (share: MuscleShare) => Math.round(share.share * 100);
  const labels: Partial<Record<Slug, string>> = {};
  for (const [slug, name] of Object.entries(REGION_NAMES) as [Slug, string][]) {
    const muscles = Object.keys(MUSCLE_SLUGS).filter(
      (muscle) => MUSCLE_SLUGS[muscle] === slug,
    );
    const used = muscles.flatMap((muscle) => byMuscle.get(muscle) ?? []);
    if (used.length === 0) {
      labels[slug] = `${name} · not worked in ${period}`;
    } else if (muscles.length === 1) {
      labels[slug] =
        `${name} · ${used[0].workouts} of ${workouts} workouts (${percent(used[0])}%)`;
    } else {
      labels[slug] = `${name} · ${used
        .map(
          (share) =>
            `${share.muscle} ${share.workouts} of ${workouts} (${percent(share)}%)`,
        )
        .join(" · ")}`;
    }
  }
  return labels;
}
