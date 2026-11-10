// Server Action for one coach exchange (#63): access check, guardrails and the model via coachReply, then both messages saved.
"use server";

import { revalidatePath } from "next/cache";
import { AccessDeniedError, requirePermission } from "@/lib/auth/access";
import { coachReply } from "@/lib/coach/chat";
import {
  coachContextFor,
  loadConversation,
  saveExchange,
} from "@/lib/coach/conversation";
import { coachChatModel, type ChatModel } from "@/lib/coach/providers";
import { groqSafetyClassifier } from "@/lib/coach/safetyModel";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_MESSAGE,
  NO_PROFILE_MESSAGE,
  TIER_MESSAGE,
  TOO_LONG_MESSAGE,
} from "./copy";

export type CoachActionState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

// Far above the 1,000 characters the coach answers; coachReply still screens the
// ends of anything longer, so only a pasted wall of text is refused outright.
const MAX_STORED_CHARS = 10_000;

// No provider key means no chat model: the turn then gets the "coach can't answer"
// reply from coachReply instead of an error page.
function chatModel(): ChatModel {
  try {
    return coachChatModel(process.env);
  } catch {
    return async () => {
      throw new Error("no chat provider configured");
    };
  }
}

export async function sendCoachMessage(
  _previous: CoachActionState,
  formData: FormData,
): Promise<CoachActionState> {
  // Outside any try: a sign-in redirect must reach Next.js.
  let userId: string;
  try {
    userId = (await requirePermission("coach")).user.id;
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { status: "error", message: TIER_MESSAGE };
    }
    throw error;
  }

  const raw = formData.get("message");
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") {
    return { status: "error", message: EMPTY_MESSAGE };
  }
  if (text.length > MAX_STORED_CHARS) {
    return { status: "error", message: TOO_LONG_MESSAGE };
  }

  const [context, conversation] = await Promise.all([
    coachContextFor(prisma, userId),
    loadConversation(prisma, userId),
  ]);
  if (!context) return { status: "error", message: NO_PROFILE_MESSAGE };

  const history = (conversation?.messages ?? []).map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));
  const key = process.env.GROQ_API_KEY;
  const turn = await coachReply(
    chatModel(),
    context,
    history,
    text,
    key ? groqSafetyClassifier(key) : undefined,
  );

  await saveExchange(
    prisma,
    userId,
    conversation?.id ?? null,
    text,
    turn.reply,
  );
  revalidatePath("/coach");
  return { status: "sent" };
}
