// What the program actions need about one user (D38): the verifier's profile, built
// from the quiz answers by the same rules the quiz save uses, the exercise library,
// and what the coach is told besides. Null when the user has not taken the quiz.
import "server-only";
import { prisma } from "@/lib/prisma";
import { parseReportedJoints } from "@/lib/coach/jointSubstitutions";
import type { CategorisedExercise, VerifyProfile } from "@/lib/coach/verify";
import type { AdaptAbout } from "./adapt";

export type ProgramContext = {
  profile: VerifyProfile;
  library: CategorisedExercise[];
  about: AdaptAbout;
  goal: "STRENGTH" | "MUSCLE" | "FAT_LOSS" | "GENERAL_FITNESS";
};

export async function loadProgramContext(
  userId: string,
): Promise<ProgramContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { weightUnit: true, profile: true },
  });
  if (!user?.profile) return null;
  const library = await prisma.exercise.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      level: true,
      equipment: true,
      primaryMuscles: true,
      secondaryMuscles: true,
    },
  });
  const { profile } = user;
  const injuries = profile.injuries ?? "";
  const muscles = [
    ...new Set(
      library.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]),
    ),
  ];
  return {
    library,
    goal: profile.goal,
    profile: {
      daysPerWeek: profile.daysPerWeek,
      level: profile.level,
      equipment: profile.equipment,
      // The quiz save's rule (onboarding/actions.ts): a muscle named in the injury text.
      avoidMuscles: muscles.filter((m) =>
        injuries.toLowerCase().includes(m.toLowerCase()),
      ),
      reportedJoints: parseReportedJoints(injuries),
    },
    about: { goal: profile.goal, injuries, units: user.weightUnit },
  };
}
