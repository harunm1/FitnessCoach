"use server";

import { prisma } from "@/lib/prisma";
import { quizProfileSchema, type QuizActionState } from "@/lib/onboarding/schema";

const demoEmail = "demo@fitnesscoach.local";

export async function saveQuizProfile(
  _previousState: QuizActionState,
  formData: FormData,
): Promise<QuizActionState> {
  const parsed = quizProfileSchema.safeParse({
    goal: formData.get("goal"),
    level: formData.get("level"),
    daysPerWeek: formData.get("daysPerWeek"),
    equipment: formData.getAll("equipment"),
    injuries: formData.get("injuries") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check your quiz answers and try again.",
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
        message: "The demo profile is not set up yet. Seed the database and try again.",
      };
    }

    await prisma.profile.upsert({
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

    return { status: "success", message: "Your training profile has been saved." };
  } catch {
    return {
      status: "error",
      message: "Could not save your profile. Check the database connection and try again.",
    };
  }
}