// The coach conversation in the database (#63): loading it, the coach's context, and saving one exchange, always by user id.
import type { PrismaClient } from "@/generated/prisma/client";
import { getNextPlanDayIndex } from "@/lib/workout/progression";
import type { CoachContext } from "./chat";

type Db = Pick<
  PrismaClient,
  "conversation" | "message" | "profile" | "plan" | "workout" | "$transaction"
>;

// The screen shows the latest turns; the model sees fewer (MAX_HISTORY_MESSAGES).
// With no active plan the prompt says so, instead of the "rest day" an empty list gives.
export const NO_PLAN_LINE = "No plan yet: the user has not saved a plan.";

export const SHOWN_MESSAGES = 50;

export type StoredMessage = {
  id: number;
  role: "USER" | "ASSISTANT";
  content: string;
};

export type Conversation = { id: number; messages: StoredMessage[] };

// The user's latest conversation, oldest message first; null before the first message.
export async function loadConversation(
  db: Db,
  userId: string,
): Promise<Conversation | null> {
  const found = await db.conversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      messages: {
        // Two rows saved together share a timestamp, so the id breaks the tie.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: SHOWN_MESSAGES,
        select: { id: true, role: true, content: true },
      },
    },
  });
  if (!found) return null;
  return { id: found.id, messages: found.messages.toReversed() };
}

// Only what the coach needs (CoachContext): the profile and the next session's lines.
export async function coachContextFor(
  db: Db,
  userId: string,
): Promise<CoachContext | null> {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: {
      goal: true,
      level: true,
      daysPerWeek: true,
      equipment: true,
      injuries: true,
    },
  });
  if (!profile) return null;
  return { ...profile, sessionLines: await nextSessionLines(db, userId) };
}

async function nextSessionLines(db: Db, userId: string): Promise<string[]> {
  const plan = await db.plan.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      days: {
        orderBy: { dayIndex: "asc" },
        select: {
          exercises: {
            orderBy: { order: "asc" },
            select: {
              sets: true,
              reps: true,
              exercise: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!plan) return [NO_PLAN_LINE];
  const done = await db.workout.count({
    where: { userId, planId: plan.id, finishedAt: { not: null } },
  });
  const index = getNextPlanDayIndex(done, plan.days.length);
  const day = index === null ? undefined : plan.days[index];
  return (day?.exercises ?? []).map(
    (e) => `${e.exercise.name} ${e.sets} x ${e.reps}`,
  );
}

// The user's message and the reply in one transaction: both are saved or neither.
// A conversation id from an earlier load is only used if it belongs to this user.
export async function saveExchange(
  db: Db,
  userId: string,
  conversationId: number | null,
  userText: string,
  reply: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const id =
      conversationId ??
      (await tx.conversation.create({ data: { userId }, select: { id: true } }))
        .id;
    if (conversationId !== null) {
      // Throws if the conversation is not this user's, which rolls back the transaction.
      await tx.conversation.update({
        where: { id, userId },
        data: { updatedAt: new Date() },
        select: { id: true },
      });
    }
    await tx.message.createMany({
      data: [
        { conversationId: id, role: "USER", content: userText },
        { conversationId: id, role: "ASSISTANT", content: reply },
      ],
    });
  });
}

// How many messages the user has sent the coach since a time, across their own
// conversations only (the per-user cap in the coach Server Action).
export async function userMessagesSince(
  db: Db,
  userId: string,
  since: Date,
): Promise<number> {
  return db.message.count({
    where: {
      role: "USER",
      conversation: { userId },
      createdAt: { gte: since },
    },
  });
}

// Whether the user has taken the quiz; the page asks for it before showing the chat.
export async function hasProfile(db: Db, userId: string): Promise<boolean> {
  return (
    (await db.profile.findUnique({
      where: { userId },
      select: { id: true },
    })) !== null
  );
}
