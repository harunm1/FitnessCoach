"use server";

import { MessageRole } from "@/generated/prisma/client";
import { BODY_MAP_MUSCLE_NAMES } from "@/lib/body-map/muscles";
import {
  buildExerciseChatMessages,
  readAssistantReply,
  type ExerciseChatActionState,
  type ExerciseChatTurn,
} from "@/lib/coach/exerciseChat";
import { coachChatModel } from "@/lib/coach/providers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const demoEmail = "demo@fitnesscoach.local";
const questionSchema = z.string().trim().min(1).max(500);

export async function askExerciseCoach(
  selectedMuscle: string,
  exerciseId: string,
  _previousState: ExerciseChatActionState,
  formData: FormData,
): Promise<ExerciseChatActionState> {
  const parsedQuestion = questionSchema.safeParse(formData.get("question"));
  if (!parsedQuestion.success) {
    return {
      status: "error",
      message: parsedQuestion.error.issues[0]?.message ?? "Enter a question.",
    };
  }

  const normalizedMuscle = selectedMuscle.trim().toLowerCase();
  if (!BODY_MAP_MUSCLE_NAMES.includes(normalizedMuscle as never)) {
    return { status: "error", message: "Select a supported muscle area." };
  }

  let model: ReturnType<typeof coachChatModel>;
  try {
    model = coachChatModel();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("API_KEY is not set")) {
      return {
        status: "error",
        message:
          "The coach is not configured. Add the selected provider key to .env.",
      };
    }
    return {
      status: "error",
      message: "The coach is not configured correctly.",
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
        message: "The demo user could not be found. Seed the database first.",
      };
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: {
        id: true,
        name: true,
        equipment: true,
        primaryMuscles: true,
        secondaryMuscles: true,
        instructions: true,
        cues: true,
        commonMistakes: true,
      },
    });
    if (!exercise) {
      return {
        status: "error",
        message: "That exercise is not in the library.",
      };
    }

    const targetsMuscle = [
      ...exercise.primaryMuscles,
      ...exercise.secondaryMuscles,
    ].some((muscle) => muscle.trim().toLowerCase() === normalizedMuscle);
    if (!targetsMuscle) {
      return {
        status: "error",
        message: "That exercise is not associated with the selected muscle.",
      };
    }

    const title = `body-map:${exercise.id}:${normalizedMuscle}`;
    const conversation = await prisma.conversation.findFirst({
      where: { userId: user.id, title },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { role: true, content: true },
        },
      },
    });
    const history: ExerciseChatTurn[] = (conversation?.messages ?? [])
      .reverse()
      .map((message) => ({ role: message.role, content: message.content }));
    const messages = buildExerciseChatMessages(
      exercise,
      normalizedMuscle,
      history,
      parsedQuestion.data,
    );
    const reply = readAssistantReply(await model(messages));
    if (!reply) {
      return {
        status: "error",
        message: "The coach returned an unreadable answer. Please try again.",
      };
    }

    const savedConversation =
      conversation ??
      (await prisma.conversation.create({
        data: { userId: user.id, title },
        select: { id: true },
      }));

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: savedConversation.id,
          role: MessageRole.USER,
          content: parsedQuestion.data,
          exerciseId: exercise.id,
          bodyRegion: normalizedMuscle,
        },
      }),
      prisma.message.create({
        data: {
          conversationId: savedConversation.id,
          role: MessageRole.ASSISTANT,
          content: reply,
          exerciseId: exercise.id,
          bodyRegion: normalizedMuscle,
        },
      }),
      prisma.conversation.update({
        where: { id: savedConversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    const turns: ExerciseChatTurn[] = [
      ...history,
      { role: "USER" as const, content: parsedQuestion.data },
      { role: "ASSISTANT" as const, content: reply },
    ].slice(-10);

    return {
      status: "success",
      message: "Answer received.",
      turns,
    };
  } catch {
    return {
      status: "error",
      message: "The coach is temporarily unavailable. Please try again.",
    };
  }
}
