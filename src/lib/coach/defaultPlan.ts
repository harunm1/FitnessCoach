// Rule-based fallback plan. Used when the coach's plan fails the verifier twice
// (docs/ARCHITECTURE.md, The coach), so a user always gets a plan that fits their
// equipment and days, even with the LLM down during the demo.
import {
  fitsProfile,
  type LibraryExercise,
  type VerifyProfile,
} from "./verify";
import type { PlanInput } from "./schema";

// One split per number of training days; each day lists the muscle groups it covers.
const SPLITS: Record<number, { name: string; muscles: string[] }[]> = {
  1: [
    {
      name: "Full body",
      muscles: ["quadriceps", "chest", "middle back", "shoulders"],
    },
  ],
  2: [
    {
      name: "Upper body",
      muscles: ["chest", "middle back", "shoulders", "triceps"],
    },
    {
      name: "Lower body",
      muscles: ["quadriceps", "hamstrings", "glutes", "abdominals"],
    },
  ],
  3: [
    { name: "Push", muscles: ["chest", "shoulders", "triceps"] },
    { name: "Pull", muscles: ["middle back", "lats", "biceps"] },
    { name: "Legs", muscles: ["quadriceps", "hamstrings", "glutes"] },
  ],
};

export function buildDefaultPlan(
  profile: VerifyProfile,
  library: LibraryExercise[],
): PlanInput {
  // More than three days repeats the three-day split, so 5 days is Push, Pull, Legs, Push, Pull.
  const base = SPLITS[Math.min(profile.daysPerWeek, 3)];
  const days = Array.from(
    { length: profile.daysPerWeek },
    (_, i) => base[i % base.length],
  );
  // Strength exercises only: free-exercise-db lists stretches under the same muscles,
  // and the dataset order puts some of them first (#15). An exercise loaded without
  // its category is kept, so a caller that does not select it still gets a plan.
  const usable = library.filter(
    (e) =>
      (e.category === undefined || e.category === "strength") &&
      fitsProfile(e, profile),
  );

  return {
    name: `${profile.daysPerWeek}-day starter plan`,
    days: days.map((day) => {
      const picked: string[] = [];
      for (const muscle of day.muscles) {
        const match = usable.find(
          (e) => e.primaryMuscles.includes(muscle) && !picked.includes(e.id),
        );
        if (match) picked.push(match.id);
      }
      for (const exercise of usable) {
        if (picked.length >= 2) break;
        if (!picked.includes(exercise.id)) picked.push(exercise.id);
      }
      if (picked.length < 2) {
        throw new Error(`Not enough compatible exercises for ${day.name}`);
      }
      return {
        name: day.name,
        exercises: picked.map((exerciseId) => ({
          exerciseId,
          sets: 3,
          reps: 10,
          restSeconds: 90,
        })),
      };
    }),
  };
}
