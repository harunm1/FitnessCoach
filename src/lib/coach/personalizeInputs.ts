// What "Personalize with the coach" (#58) plans from: the user's gym profile and the
// exercise library. generatePlan writes strength plans only, so running and hybrid
// profiles get "not-gym" and keep their week. Avoided muscles are matched from the injury
// text as onboarding does (src/app/onboarding/actions.ts); the injury text itself never
// reaches the model.
import type { PrismaClient } from "@/generated/prisma/client";
import { draftExerciseJointMappings } from "./exerciseJointMappings";
import { parseReportedJoints, type Joint } from "./jointSubstitutions";
import type { PersonalizeInputs } from "./personalize";

type Database = {
  profile: Pick<PrismaClient["profile"], "findUnique">;
  exercise: Pick<PrismaClient["exercise"], "findMany">;
};

export async function loadPersonalizeInputs(
  database: Database,
  userId: string,
): Promise<PersonalizeInputs | "no-profile" | "not-gym"> {
  const profile = await database.profile.findUnique({
    where: { userId },
    select: {
      trainingMode: true,
      daysPerWeek: true,
      equipment: true,
      injuries: true,
    },
  });
  if (!profile) return "no-profile";
  if (profile.trainingMode !== "GYM") return "not-gym";

  // The prompt lists names (buildPlanPrompt), so the name is selected with the id.
  const everyExercise = await database.exercise.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      equipment: true,
      primaryMuscles: true,
      secondaryMuscles: true,
    },
  });
  const injuryText = (profile.injuries ?? "").toLowerCase();
  // Muscle names come from the whole library, so an injury still matches a muscle that
  // only a stretch lists.
  const muscleNames = [
    ...new Set(
      everyExercise.flatMap((exercise) => [
        ...exercise.primaryMuscles,
        ...exercise.secondaryMuscles,
      ]),
    ),
  ];
  // The quiz passes the joints the user reported as painful (onboarding/actions.ts), and
  // verifyPlan rejects a slot that loads one or has no joint mapping. Same input here.
  const reportedJoints = parseReportedJoints(profile.injuries ?? "");
  // generatePlan writes strength plans, and the verifier accepts any id in the library
  // it is given, so the coach is offered strength exercises only (the rule the starter
  // plan applies in defaultPlan.ts). Cardio and stretching would otherwise pass and be saved.
  const strength = everyExercise.filter(
    (exercise) => exercise.category.toLowerCase() === "strength",
  );
  return {
    profile: {
      daysPerWeek: profile.daysPerWeek,
      equipment: profile.equipment,
      avoidMuscles: muscleNames.filter((muscle) =>
        injuryText.includes(muscle.toLowerCase()),
      ),
      reportedJoints,
    },
    // With a reported joint, offer only what verifyPlan would accept, so the model is not
    // asked for exercises that are then rejected (an unmapped exercise is rejected too).
    library:
      reportedJoints.length === 0
        ? strength
        : strength.filter((exercise) =>
            safeForJoints(exercise.id, reportedJoints),
          ),
  };
}

function safeForJoints(exerciseId: string, reported: Joint[]): boolean {
  if (!Object.hasOwn(draftExerciseJointMappings, exerciseId)) return false;
  const { joints } =
    draftExerciseJointMappings[
      exerciseId as keyof typeof draftExerciseJointMappings
    ];
  return !joints.some((joint) => reported.includes(joint));
}
