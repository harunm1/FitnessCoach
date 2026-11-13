// Quiz plans with run days (#85): a running or both-mode quiz becomes a hybrid week, verified, then saved with its RUN days.
import type { PrismaClient } from "@/generated/prisma/client";
import { buildHybridWeek, splitDays } from "@/lib/coach/hybridWeek";
import { saveWeek } from "@/lib/coach/saveWeek";
import { verifyPlan } from "@/lib/coach/verify";
import type { LibraryExercise, VerifyProfile } from "@/lib/coach/verify";
import { verifyRunningPlan } from "@/lib/coach/verifyRunning";
import type { QuizProfileInput } from "./schema";

// The quiz does not ask about activity, mileage or pace yet, so a new runner starts at
// the light group's volume (verifyRunning.ts STARTING_WEEK_KM) with an easy pace by feel.
// Decision D9 note in docs/ARCHITECTURE.md.
const NEW_RUNNER = {
  activityLevel: "LIGHT",
  lastWeekKm: null,
  easyPaceSecPerKm: null,
} as const;

export type HybridQuizResult =
  { ok: true; name: string } | { ok: false; reason: "library" | "verify" };

// Builds the week, runs the same verifiers the coach's plans pass (D9), then saves the
// profile and the plan in one transaction as the user's only active plan. "library"
// means the exercises cannot fill the strength days; database errors are thrown.
export async function saveHybridQuizWeek(
  prisma: PrismaClient,
  userId: string,
  quiz: QuizProfileInput,
  planProfile: VerifyProfile,
  library: LibraryExercise[],
): Promise<HybridQuizResult> {
  const runProfile = { ...planProfile, ...NEW_RUNNER };
  let week;
  try {
    week = buildHybridWeek(
      { ...runProfile, goal: quiz.goal, trainingMode: quiz.trainingMode },
      library,
    );
  } catch {
    return { ok: false, reason: "library" };
  }

  if (!weekPassesVerifiers(week, quiz, planProfile, library)) {
    return { ok: false, reason: "verify" };
  }

  const profile = { ...quiz, injuries: quiz.injuries || null };
  await saveWeek(prisma, userId, week, "DEFAULT", async (tx) => {
    await tx.profile.upsert({
      where: { userId },
      create: { userId, ...profile },
      update: profile,
    });
  });
  return { ok: true, name: week.name };
}

function weekPassesVerifiers(
  week: ReturnType<typeof buildHybridWeek>,
  quiz: QuizProfileInput,
  planProfile: VerifyProfile,
  library: LibraryExercise[],
): boolean {
  const strength = week.days.flatMap((day) =>
    day.kind === "STRENGTH"
      ? [{ name: day.name, exercises: day.exercises }]
      : [],
  );
  const runs = week.days.flatMap((day) =>
    day.kind === "RUN" ? [{ name: day.name, run: day.run }] : [],
  );
  const { strengthDays, runDays } = splitDays(
    quiz.daysPerWeek,
    quiz.goal,
    quiz.trainingMode,
  );

  if (strengthDays > 0) {
    const verdict = verifyPlan(
      { name: week.name, days: strength },
      { ...planProfile, daysPerWeek: strengthDays },
      new Map(library.map((exercise) => [exercise.id, exercise])),
    );
    if (!verdict.ok) return false;
  }
  if (runDays > 0) {
    const verdict = verifyRunningPlan(
      { name: week.name, days: runs },
      { runDaysPerWeek: runDays, ...NEW_RUNNER },
    );
    if (!verdict.ok) return false;
  }
  return true;
}
