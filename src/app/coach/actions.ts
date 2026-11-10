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
  SAVE_FAILED_MESSAGE,
  TIER_MESSAGE,
  TOO_LONG_MESSAGE,
} from "./copy";

export type CoachActionState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string }
  // Nothing was stored: the text comes back for "Send again", with the reply if one
  // was written but could not be saved (#42).
  | { status: "unsaved"; text: string; message: string; reply?: string };

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

  // The quick-reply button that was pressed, otherwise the text box.
  const text =
    [formData.get("quickReply"), formData.get("message")]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find((value) => value !== "") ?? "";
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

  // The "coach can't answer" reply is not part of the conversation: nothing is saved
  // and the user can send the same text again.
  if (turn.source === "UNAVAILABLE") {
    return { status: "unsaved", text, message: turn.reply };
  }

  try {
    await saveExchange(
      prisma,
      userId,
      conversation?.id ?? null,
      text,
      turn.reply,
    );
  } catch {
    // The reply is shown once, marked as not saved; the database error is not.
    return {
      status: "unsaved",
      text,
      reply: turn.reply,
      message: SAVE_FAILED_MESSAGE,
    };
  }
  revalidatePath("/coach");
  return { status: "sent" };
}
