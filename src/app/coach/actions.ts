// Server Action for one coach exchange (#63): access check, guardrails and the model via coachReply, then both messages saved.
"use server";

import { revalidatePath } from "next/cache";
import { AccessDeniedError, requirePermission } from "@/lib/auth/access";
import { coachReply, MAX_MESSAGE_CHARS } from "@/lib/coach/chat";
import {
  coachContextFor,
  loadConversation,
  saveExchange,
  userMessagesSince,
} from "@/lib/coach/conversation";
import { checkUserMessage } from "@/lib/coach/guardrails";
import { coachChatModel, type CoachChatModel } from "@/lib/coach/providers";
import { groqSafetyClassifier } from "@/lib/coach/safetyModel";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_MESSAGE,
  LOAD_FAILED_MESSAGE,
  NO_PROFILE_MESSAGE,
  RATE_DAY_MESSAGE,
  RATE_MINUTE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  TIER_MESSAGE,
  TOO_LONG_MESSAGE,
} from "./copy";
import { COACH_LIMITS, coachAttempts } from "./limits";

const RATE_MESSAGES = {
  minute: RATE_MINUTE_MESSAGE,
  day: RATE_DAY_MESSAGE,
} as const;

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

// The caps (limits.ts) are checked twice: against saved messages in the database,
// which holds across server instances, and by the in-memory attempt limiter, taken
// just before the model call, which also counts parallel and failed sends.
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

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

// A Prisma error code such as P2025 for the server log; never the message text,
// which can hold what the user typed.
function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "unknown";
}

// A refusal here (too long, or over a cap) comes before coachReply's safety screen, so
// the word list is run on the message first: a crisis, red-flag or pain message gets
// its fixed reply instead of the refusal (review of 13 Nov). No model call. Only the
// two ends of a long message are read, as coachReply does.
function refusal(text: string, message: string): CoachActionState {
  const ends =
    text.length > 2 * MAX_MESSAGE_CHARS
      ? `${text.slice(0, MAX_MESSAGE_CHARS)} ${text.slice(-MAX_MESSAGE_CHARS)}`
      : text;
  const guard = checkUserMessage(ends);
  const safety = guard.action !== "ALLOW" && guard.action !== "OFF_TOPIC";
  return { status: "error", message: safety ? guard.reply : message };
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
  if (text === "") {
    return { status: "error", message: EMPTY_MESSAGE };
  }
  if (text.length > MAX_STORED_CHARS) {
    return refusal(text, TOO_LONG_MESSAGE);
  }

  let loaded;
  try {
    const now = Date.now();
    loaded = await Promise.all([
      coachContextFor(prisma, userId),
      loadConversation(prisma, userId),
      userMessagesSince(prisma, userId, new Date(now - MINUTE_MS)),
      userMessagesSince(prisma, userId, new Date(now - DAY_MS)),
    ]);
  } catch (error) {
    console.error("coach: conversation load failed", errorCode(error));
    // The typed text comes back with Send again rather than the route's error page.
    return { status: "unsaved", text, message: LOAD_FAILED_MESSAGE };
  }
  const [context, conversation, lastMinute, lastDay] = loaded;
  if (!context) return { status: "error", message: NO_PROFILE_MESSAGE };
  if (lastMinute >= COACH_LIMITS.perMinute) {
    return refusal(text, RATE_MINUTE_MESSAGE);
  }
  if (lastDay >= COACH_LIMITS.perDay) {
    return refusal(text, RATE_DAY_MESSAGE);
  }
  // Synchronous, so of several sends in flight only the first ones get through.
  const refused = coachAttempts.take(userId);
  if (refused) return refusal(text, RATE_MESSAGES[refused]);

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
