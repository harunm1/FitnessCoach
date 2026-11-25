// Server Action for one coach exchange (#63): access check, guardrails and the model via coachReply, then both messages saved.
"use server";

import { revalidatePath } from "next/cache";
import { AccessDeniedError, requirePermission } from "@/lib/auth/access";
import { coachReply } from "@/lib/coach/chat";
import { saveExchange } from "@/lib/coach/conversation";
import { coachChatModel, type CoachChatModel } from "@/lib/coach/providers";
import { groqSafetyClassifier } from "@/lib/coach/safetyModel";
import { prisma } from "@/lib/prisma";
import { SAVE_FAILED_MESSAGE, TIER_MESSAGE } from "./copy";
import { errorCode, prepareCoachRequest } from "./request";

export type CoachActionState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string }
  // Nothing was stored: the text comes back for "Send again", with the reply if one
  // was written but could not be saved (#42). example marks a stored demo reply (D12).
  | {
      status: "unsaved";
      text: string;
      message: string;
      reply?: string;
      example?: boolean;
    };

// No provider key means no chat model: the turn then gets the "coach can't answer"
// reply from coachReply instead of an error page.
function chatModel(): CoachChatModel {
  try {
    return coachChatModel(process.env);
  } catch (error) {
    // The message names a missing key or a bad COACH_PROVIDER value, never user text.
    console.error(
      "coach: chat model not configured",
      error instanceof Error ? error.message : "unknown",
    );
    return async () => {
      throw new Error("no chat provider configured");
    };
  }
}

export async function sendCoachMessage(
  _previous: CoachActionState,
  formData: FormData,
): Promise<CoachActionState> {
  // Only AccessDeniedError is caught; a sign-in redirect is re-thrown to Next.js.
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
  const admission = await prepareCoachRequest(userId, text);
  if (!admission.ok) return admission.state;
  const { context, conversation } = admission;

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
  } catch (error) {
    console.error("coach: exchange not saved", errorCode(error));
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
