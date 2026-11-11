"use server";

import { prisma } from "@/lib/prisma";
import {
  quizProfileSchema,
  type QuizActionState,
} from "@/lib/onboarding/schema";
import { PlanSource, TrainingMode } from "@/generated/prisma/client";
import { buildDefaultPlan } from "@/lib/coach/defaultPlan";
import { saveHybridQuizWeek } from "@/lib/onboarding/hybridQuiz";
import { verifyPlan } from "@/lib/coach/verify";

const demoEmail = "demo@fitnesscoach.local";

export async function saveQuizProfile(
  _previousState: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const parsed = quizProfileSchema.safeParse({
    goal: formData.get("goal"),
    level: formData.get("level"),
    trainingMode: formData.get("trainingMode") ?? undefined,
    daysPerWeek: formData.get("daysPerWeek"),
    equipment: formData.getAll("equipment"),
    injuries: formData.get("injuries") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "Check your quiz answers and try again.",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: demoEmail },
      select: { id: true },
    });

    if (!user) {
      return {
        status: "error",
        message:
          "The demo profile is not set up yet. Seed the database and try again.",
      };
    }

    const library = await prisma.exercise.findMany({
      select: {
        id: true,
        equipment: true,
        primaryMuscles: true,
        secondaryMuscles: true,
      },
    });
    const injuryText = parsed.data.injuries.toLowerCase();
    const muscleNames = [
      ...new Set(
        library.flatMap((exercise) => [
          ...exercise.primaryMuscles,
          ...exercise.secondaryMuscles,
        ]),
      ),
    ];
    const planProfile = {
      daysPerWeek: parsed.data.daysPerWeek,
      equipment: parsed.data.equipment,
      avoidMuscles: muscleNames.filter((muscle) =>
        injuryText.includes(muscle.toLowerCase()),
      ),
    };

    if (parsed.data.trainingMode !== TrainingMode.GYM) {
      const saved = await saveHybridQuizWeek(
        prisma,
        user.id,
        parsed.data,
        planProfile,
        library,
      );
      if (saved.ok) {
        return {
          status: "success",
          message: `Your profile and ${saved.name} have been saved.`,
        };
      }
      return {
        status: "error",
        message:
          saved.reason === "library"
            ? "There are not enough suitable exercises for that equipment and injury selection. Update your answers and try again."
            : "We could not verify a suitable plan. Please update your answers and try again.",
      };
    }

    let plan;
    try {
      plan = buildDefaultPlan(planProfile, library);
    } catch {
      return {
        status: "error",
        message:
          "There are not enough suitable exercises for that equipment and injury selection. Update your answers and try again.",
      };
    }

    const verification = verifyPlan(
      plan,
      planProfile,
      new Map(library.map((exercise) => [exercise.id, exercise])),
    );
    if (!verification.ok) {
      return {
        status: "error",
        message:
          "We could not verify a suitable plan. Please update your answers and try again.",
      };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...parsed.data,
          injuries: parsed.data.injuries || null,
        },
        update: {
          ...parsed.data,
          injuries: parsed.data.injuries || null,
        },
      });
      await transaction.plan.updateMany({
        where: { userId: user.id, active: true },
        data: { active: false },
      });
      await transaction.plan.create({
        data: {
          userId: user.id,
          name: plan.name,
          source: PlanSource.DEFAULT,
          days: {
            create: plan.days.map((day, dayIndex) => ({
              dayIndex,
              name: day.name,
              exercises: {
                create: day.exercises.map((exercise, order) => ({
                  exerciseId: exercise.exerciseId,
                  order,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restSeconds: exercise.restSeconds,
                })),
              },
            })),
          },
        },
      });
    });

    return {
      status: "success",
      message: `Your profile and ${plan.name} have been saved.`,
    };
  } catch {
    return {
      status: "error",
      message:
        "Could not save your profile. Check the database connection and try again.",
    };
  }
}
