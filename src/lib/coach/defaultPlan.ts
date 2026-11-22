// Rule-based fallback plan. Used when the coach's plan fails the verifier twice
// (docs/ARCHITECTURE.md, The coach), so a user always gets a plan that fits their
// equipment and days, even with the LLM down during the demo.
import {
  fitsProfile,
  type CategorisedExercise,
  type LibraryExercise,
  type VerifyProfile,
} from "./verify";
import { LIMITS, type PlanInput } from "./schema";

// The fallback asks for a moderate effort: 7 is "about three reps left" (#65).
const DEFAULT_RPE = 7;

// One split per number of training days; each day lists the muscle groups it covers, and
// the accessory muscles added for intermediate and expert users (#139).
type Split = { name: string; muscles: string[]; extras: string[] };
const SPLITS: Record<number, Split[]> = {
  1: [
    {
      name: "Full body",
      muscles: ["quadriceps", "chest", "middle back", "shoulders"],
      extras: ["hamstrings", "biceps", "triceps", "abdominals", "glutes"],
    },
  ],
  2: [
    {
      name: "Upper body",
      muscles: ["chest", "middle back", "shoulders", "triceps"],
      extras: ["lats", "biceps", "abdominals"],
    },
    {
      name: "Lower body",
      muscles: ["quadriceps", "hamstrings", "glutes", "abdominals"],
      extras: ["calves", "lower back", "adductors"],
    },
  ],
  3: [
    {
      name: "Push",
      muscles: ["chest", "shoulders", "triceps"],
      extras: ["triceps", "abdominals", "shoulders"],
    },
    {
      name: "Pull",
      muscles: ["middle back", "lats", "biceps"],
      extras: ["abdominals", "forearms", "traps"],
    },
    {
      name: "Legs",
      muscles: ["quadriceps", "hamstrings", "glutes"],
      extras: ["calves", "abdominals", "adductors"],
    },
  ],
};

// How many accessory muscles a day adds: the more experienced the user, the longer the day.
const EXTRAS_BY_LEVEL = { BEGINNER: 0, INTERMEDIATE: 1, EXPERT: 3 } as const;
const LEVEL_RANK = { BEGINNER: 0, INTERMEDIATE: 1, EXPERT: 2 } as const;
// An exercise above the user's level goes behind every fit at or below it.
const ABOVE_LEVEL_PENALTY = 100;
const UNLISTED_EQUIPMENT_RANK = 99;

// Big lifts first, for experienced users: free weights, then machines, then the rest.
const EQUIPMENT_ORDER = [
  "barbell",
  "dumbbell",
  "e-z curl bar",
  "machine",
  "cable",
  "kettlebells",
  "bands",
  "body only",
];
// The muscles trained by the big compound lifts; a day is ordered by them, and they get
// the heavier prescription for intermediate and expert users.
const COMPOUND_MUSCLES = [
  "quadriceps",
  "hamstrings",
  "glutes",
  "chest",
  "middle back",
  "lats",
  "shoulders",
];
const COMPOUND = { sets: 4, reps: 8, restSeconds: 120 };
const ACCESSORY = { sets: 3, reps: 10, restSeconds: 90 };

type Level = keyof typeof LEVEL_RANK;

// Lower is better: a fit at or below the user's level, then (for intermediate and expert
// users) free weights before machines before kettlebells and bodyweight. With no level
// given, every exercise scores the same and the first fit wins, as before.
function score(exercise: LibraryExercise, level: Level | undefined): number {
  if (!level) return 0;
  // A row with no level, or one we do not know, gets no penalty.
  const exerciseLevel = LEVEL_RANK[(exercise.level ?? "") as Level];
  const above = exerciseLevel > LEVEL_RANK[level] ? ABOVE_LEVEL_PENALTY : 0;
  if (level === "BEGINNER") return above;
  const equipment = EQUIPMENT_ORDER.indexOf(exercise.equipment ?? "body only");
  return above + (equipment < 0 ? UNLISTED_EQUIPMENT_RANK : equipment);
}

const compoundRank = (exercise: LibraryExercise) => {
  const rank = COMPOUND_MUSCLES.indexOf(exercise.primaryMuscles[0]);
  return rank < 0 ? COMPOUND_MUSCLES.length : rank;
};

// A simplification: a lift is called compound by its first primary muscle and free-weight
// equipment, not by what the movement is, because the library carries no lift type. A
// dumbbell fly counts; a leg press (machine) does not.
const isCompound = (exercise: LibraryExercise) =>
  compoundRank(exercise) < COMPOUND_MUSCLES.length &&
  (exercise.equipment === "barbell" || exercise.equipment === "dumbbell");

export function buildDefaultPlan(
  profile: VerifyProfile,
  library: CategorisedExercise[],
): PlanInput {
  // More than three days repeats the three-day split, so 5 days is Push, Pull, Legs, Push, Pull.
  const base = SPLITS[Math.min(profile.daysPerWeek, 3)];
  const days = Array.from(
    { length: profile.daysPerWeek },
    (_, i) => base[i % base.length],
  );
  // Strength exercises only: free-exercise-db lists stretches under the same muscles,
  // and the dataset order puts some of them first (#71, found on #15). The `?.` skips,
  // rather than crashes on, an exercise an untyped caller passes without a category.
  const usable = library.filter(
    (e) => e.category?.toLowerCase() === "strength" && fitsProfile(e, profile),
  );

  const level = profile.level;
  const extras = level ? EXTRAS_BY_LEVEL[level] : 0;
  const heavy = level === "INTERMEDIATE" || level === "EXPERT";
  // Best fit first; the sort is stable, so equal scores keep the library's order.
  const ranked = [...usable].sort((a, b) => score(a, level) - score(b, level));

  return {
    name: `${profile.daysPerWeek}-day starter plan`,
    days: days.map((day) => {
      const picked: CategorisedExercise[] = [];
      for (const muscle of [...day.muscles, ...day.extras.slice(0, extras)]) {
        const match = ranked.find(
          (e) =>
            e.primaryMuscles.includes(muscle) &&
            !picked.some((chosen) => chosen.id === e.id),
        );
        if (match) picked.push(match);
      }
      for (const exercise of usable) {
        if (picked.length >= 2) break;
        if (!picked.some((chosen) => chosen.id === exercise.id))
          picked.push(exercise);
      }
      if (picked.length < 2) {
        throw new Error(`Not enough compatible exercises for ${day.name}`);
      }
      // With a level known, the big lifts come first in the day.
      const ordered = level
        ? [...picked].sort((a, b) => compoundRank(a) - compoundRank(b))
        : picked;
      return {
        name: day.name,
        exercises: ordered
          .slice(0, LIMITS.exercisesPerDay.max)
          .map((exercise) => ({
            exerciseId: exercise.id,
            ...(heavy && isCompound(exercise) ? COMPOUND : ACCESSORY),
            rpe: DEFAULT_RPE,
          })),
      };
    }),
  };
}
