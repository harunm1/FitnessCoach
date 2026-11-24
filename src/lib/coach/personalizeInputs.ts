// What "Personalize with the coach" (#58) plans from: the user's gym profile and the
// exercise library. generatePlan writes strength plans only, so running and hybrid
// profiles get null and keep their week. Avoided muscles are matched from the injury
// text as onboarding does (src/app/onboarding/actions.ts); the injury text itself never
// reaches the model.
import type { PrismaClient } from "@/generated/prisma/client";
import type { PersonalizeInputs } from "./personalize";

type Database = {
  profile: Pick<PrismaClient["profile"], "findUnique">;
  exercise: Pick<PrismaClient["exercise"], "findMany">;
};

export async function loadPersonalizeInputs(
  database: Database,
  userId: string,
): Promise<PersonalizeInputs | null> {
  const profile = await database.profile.findUnique({
    where: { userId },
    select: {
      trainingMode: true,
      daysPerWeek: true,
      equipment: true,
      injuries: true,
    },
  });
  if (!profile || profile.trainingMode !== "GYM") return null;

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
  return {
    profile: {
      daysPerWeek: profile.daysPerWeek,
      equipment: profile.equipment,
      avoidMuscles: muscleNames.filter((muscle) =>
        injuryText.includes(muscle.toLowerCase()),
      ),
    },
    // generatePlan writes strength plans, and the verifier accepts any id in the library
    // it is given, so the coach is offered strength exercises only (the rule the starter
    // plan applies in defaultPlan.ts). Cardio and stretching would otherwise pass and be saved.
    library: everyExercise.filter(
      (exercise) => exercise.category.toLowerCase() === "strength",
    ),
  };
}
