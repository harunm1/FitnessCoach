// The verifier: plain TypeScript, no second model (docs/ARCHITECTURE.md, The coach).
// It runs on every plan before anything is saved or shown. The schema checks shape
// and ranges; this checks the plan against the user and the exercise library:
//   - every exercise id exists in our library
//   - it fits the user's equipment and avoids reported injuries
//   - no exercise appears twice on one day
//   - the plan has as many days as the user asked for
// It returns every problem it finds, not just the first, so a regeneration prompt
// can list them all (same idea as reporting all validation errors at once in A2).
import { LIMITS, planSchema, type PlanInput } from "./schema";

export type LibraryExercise = {
  id: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

export type VerifyProfile = {
  daysPerWeek: number;
  equipment: string[];
  // Muscle names the user reported trouble with, taken from the quiz's injury text.
  avoidMuscles: string[];
};

export type VerifyResult =
  { ok: true; plan: PlanInput } | { ok: false; problems: string[] };

// "body only" exercises need no equipment, so they fit everyone.
const NO_EQUIPMENT = new Set([null, "body only"]);

export function verifyPlan(
  raw: unknown,
  profile: VerifyProfile,
  library: Map<string, LibraryExercise>,
): VerifyResult {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "plan"}: ${issue.message}`,
      ),
    };
  }
  const plan = parsed.data;
  const problems: string[] = [];

  if (plan.days.length !== profile.daysPerWeek) {
    problems.push(
      `plan has ${plan.days.length} days; the user asked for ${profile.daysPerWeek}`,
    );
  }

  const owned = new Set(profile.equipment.map((e) => e.toLowerCase()));
  const avoid = new Set(profile.avoidMuscles.map((m) => m.toLowerCase()));

  plan.days.forEach((day, dayIndex) => {
    const seen = new Set<string>();
    day.exercises.forEach((slot) => {
      const where = `day ${dayIndex + 1} (${day.name}), ${slot.exerciseId}`;
      if (seen.has(slot.exerciseId)) {
        problems.push(`${where}: appears twice on the same day`);
      }
      seen.add(slot.exerciseId);

      const exercise = library.get(slot.exerciseId);
      if (!exercise) {
        problems.push(`${where}: not in the exercise library`);
        return;
      }
      if (
        !NO_EQUIPMENT.has(exercise.equipment) &&
        !owned.has(exercise.equipment!.toLowerCase())
      ) {
        problems.push(
          `${where}: needs ${exercise.equipment}, which the user does not have`,
        );
      }
      const hits = [
        ...exercise.primaryMuscles,
        ...exercise.secondaryMuscles,
      ].filter((m) => avoid.has(m.toLowerCase()));
      if (hits.length > 0) {
        problems.push(
          `${where}: works ${hits.join(", ")}, which the user reported trouble with`,
        );
      }
    });
  });

  return problems.length === 0 ? { ok: true, plan } : { ok: false, problems };
}

export { LIMITS };
