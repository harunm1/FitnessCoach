// Fitting a template to the user's kit by rule, before and without the coach (D38).
// An exercise the user cannot do (missing equipment, a muscle they reported trouble
// with, a painful joint) is swapped for a strength exercise on the same primary muscle
// that they can do. No match: no change, and the guardrails report the slot, so the
// template is shown as not fitting rather than saved broken.
import { draftExerciseJointMappings } from "@/lib/coach/exerciseJointMappings";
import {
  fitsProfile,
  type CategorisedExercise,
  type VerifyProfile,
} from "@/lib/coach/verify";
import type { Change } from "./changes";
import type { ProgramTemplate } from "./templateSchema";

const jointSafe = (id: string, profile: VerifyProfile): boolean => {
  const joints = profile.reportedJoints ?? [];
  if (joints.length === 0) return true;
  const mapping = Object.hasOwn(draftExerciseJointMappings, id)
    ? draftExerciseJointMappings[id as keyof typeof draftExerciseJointMappings]
    : undefined;
  return !!mapping && !mapping.joints.some((j) => joints.includes(j));
};

const usable = (e: CategorisedExercise, profile: VerifyProfile) =>
  fitsProfile(e, profile) && jointSafe(e.id, profile);

// As the starter plan does (defaultPlan.ts, #103): with a level known, a swap is never
// above it. A row with no level, or one we do not know, is never above the user's.
const LEVEL_RANK: Record<string, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  EXPERT: 2,
};
const atOrBelow = (e: CategorisedExercise, profile: VerifyProfile) =>
  !profile.level ||
  (LEVEL_RANK[e.level ?? ""] ?? 0) <= LEVEL_RANK[profile.level];

// Why an exercise was swapped: equipment first, then muscles, then joints.
function whyNot(e: CategorisedExercise, profile: VerifyProfile): string {
  const name = e.name ?? e.id;
  const hasKit = fitsProfile(
    { ...e, primaryMuscles: [], secondaryMuscles: [] },
    profile,
  );
  if (!hasKit) return `${name} needs ${e.equipment}, which you did not list`;
  if (!fitsProfile(e, profile)) {
    return `${name} works a muscle you reported trouble with`;
  }
  return `${name} loads a joint you reported painful`;
}

export function fitChanges(
  template: ProgramTemplate,
  profile: VerifyProfile,
  library: CategorisedExercise[],
): Change[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  const strength = library.filter(
    (e) =>
      e.category?.toLowerCase() === "strength" &&
      usable(e, profile) &&
      atOrBelow(e, profile),
  );
  return template.days.flatMap((day, d) => {
    const onDay = new Set(day.exercises.map((s) => s.exerciseId));
    return day.exercises.flatMap((slot, s): Change[] => {
      const original = byId.get(slot.exerciseId);
      if (!original || usable(original, profile)) return [];
      const replacement = strength.find(
        (e) =>
          e.primaryMuscles[0] === original.primaryMuscles[0] &&
          !onDay.has(e.id),
      );
      if (!replacement) return [];
      onDay.add(replacement.id);
      return [
        {
          id: `rule-${d + 1}-${s + 1}`,
          source: "rule",
          op: "swap",
          day: d,
          slot: s,
          exerciseId: replacement.id,
          reason: `${whyNot(original, profile)}; ${replacement.name ?? replacement.id} works the same muscle`,
        },
      ];
    });
  });
}
