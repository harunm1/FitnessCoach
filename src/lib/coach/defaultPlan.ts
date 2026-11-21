// Rule-based fallback plan. Used when the coach's plan fails the verifier twice
// (docs/ARCHITECTURE.md, The coach), so a user always gets a plan that fits their
// equipment and days, even with the LLM down during the demo.
import {
  fitsProfile,
  type CategorisedExercise,
  type VerifyProfile,
} from "./verify";
import type { PlanInput } from "./schema";
import { draftExerciseJointMappings } from "./exerciseJointMappings";
import { findJointSubstitution, type Joint } from "./jointSubstitutions";

// The fallback asks for a moderate effort: 7 is "about three reps left" (#65).
const DEFAULT_RPE = 7;

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

  const resolveJointAware = (
    exerciseId: string,
  ): { exerciseId: string; substitutionReason?: string } | undefined => {
    const reportedJoints = profile.reportedJoints ?? [];
    if (reportedJoints.length === 0) {
      return { exerciseId };
    }

    const original = Object.hasOwn(draftExerciseJointMappings, exerciseId)
      ? draftExerciseJointMappings[
          exerciseId as keyof typeof draftExerciseJointMappings
        ]
      : undefined;
    if (!original) return undefined;
    if (!original.joints.some((joint) => reportedJoints.includes(joint))) {
      return { exerciseId };
    }

    const replacement = findJointSubstitution(
      exerciseId,
      usable.map((exercise) => exercise.id),
      reportedJoints,
      draftExerciseJointMappings,
    );
    if (!replacement) return undefined;

    const avoided = reportedJoints.filter((joint: Joint) =>
      (original.joints as readonly Joint[]).includes(joint),
    );
    return {
      exerciseId: replacement,
      substitutionReason:
        avoided.length === 1
          ? `avoids ${avoided[0]} loading`
          : `avoids loading ${avoided.join(" and ")}`,
    };
  };

  return {
    name: `${profile.daysPerWeek}-day starter plan`,
    days: days.map((day) => {
      const picked: string[] = [];
      const substitutions = new Map<string, string>();
      for (const muscle of day.muscles) {
        const match = usable.find(
          (e) =>
            e.primaryMuscles.includes(muscle) &&
            !picked.includes(e.id) &&
            resolveJointAware(e.id) !== undefined,
        );
        if (match) {
          const resolved = resolveJointAware(match.id);
          if (resolved && !picked.includes(resolved.exerciseId)) {
            picked.push(resolved.exerciseId);
            if (resolved.substitutionReason) {
              substitutions.set(
                resolved.exerciseId,
                resolved.substitutionReason,
              );
            }
          }
        }
      }
      for (const exercise of usable) {
        if (picked.length >= 2) break;
        const resolved = resolveJointAware(exercise.id);
        if (resolved && !picked.includes(resolved.exerciseId)) {
          picked.push(resolved.exerciseId);
          if (resolved.substitutionReason) {
            substitutions.set(resolved.exerciseId, resolved.substitutionReason);
          }
        }
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
          rpe: DEFAULT_RPE,
          substitutionReason: substitutions.get(exerciseId),
        })),
      };
    }),
  };
}
