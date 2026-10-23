// Rule-based fallback plan. Used when the coach's plan fails the verifier twice
// (docs/ARCHITECTURE.md, The coach), so a user always gets a plan that fits their
// equipment and days, even with the LLM down during the demo.
import type { LibraryExercise, VerifyProfile } from "./verify";
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

const NO_EQUIPMENT = new Set([null, "body only"]);

function fits(exercise: LibraryExercise, profile: VerifyProfile): boolean {
  const owned = new Set(profile.equipment.map((e) => e.toLowerCase()));
  const avoid = new Set(profile.avoidMuscles.map((m) => m.toLowerCase()));
  const hasKit =
    NO_EQUIPMENT.has(exercise.equipment) ||
    owned.has(exercise.equipment!.toLowerCase());
  const safe = ![...exercise.primaryMuscles, ...exercise.secondaryMuscles].some(
    (m) => avoid.has(m.toLowerCase()),
  );
  return hasKit && safe;
}

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
  const usable = library.filter((e) => fits(e, profile));

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
