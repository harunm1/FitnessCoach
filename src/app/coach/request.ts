// Shared admission for the coach action and streaming route. Identity must come from a verified server session.
import { MAX_MESSAGE_CHARS } from "@/lib/coach/chat";
import {
  coachContextFor,
  loadConversation,
  userMessagesSince,
} from "@/lib/coach/conversation";
import { checkUserMessage } from "@/lib/coach/guardrails";
import { prisma } from "@/lib/prisma";
import type { CoachActionState } from "./actions";
import {
  EMPTY_MESSAGE,
  LOAD_FAILED_MESSAGE,
  NO_PROFILE_MESSAGE,
  RATE_DAY_MESSAGE,
  RATE_MINUTE_MESSAGE,
  TOO_LONG_MESSAGE,
} from "./copy";
import { COACH_LIMITS, coachAttempts } from "./limits";
const MAX_STORED_CHARS = 10_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const RATE_MESSAGES = { minute: RATE_MINUTE_MESSAGE, day: RATE_DAY_MESSAGE };
export function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "unknown";
}
const NEEDS_HELP: ReadonlySet<string> = new Set([
  "CRISIS",
  "RED_FLAG",
  "CHECK_IN",
  "EATING_SUPPORT",
  "PAIN_STOP",
]);
function refusal(text: string, message: string): CoachActionState {
  const ends =
    text.length > 2 * MAX_MESSAGE_CHARS
      ? `${text.slice(0, MAX_MESSAGE_CHARS)} … ${text.slice(-MAX_MESSAGE_CHARS)}`
      : text;
  const guard = checkUserMessage(ends);
  const help = guard.action !== "ALLOW" && NEEDS_HELP.has(guard.action);
  return { status: "error", message: help ? guard.reply : message };
}

export async function prepareCoachRequest(userId: string, text: string) {
  if (text === "") {
    return {
      ok: false as const,
      status: 400,
      state: { status: "error" as const, message: EMPTY_MESSAGE },
    };
  }
  if (text.length > MAX_STORED_CHARS) {
    return {
      ok: false as const,
      status: 400,
      state: refusal(text, TOO_LONG_MESSAGE),
    };
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
    return {
      ok: false as const,
      status: 503,
      state: { status: "unsaved" as const, text, message: LOAD_FAILED_MESSAGE },
    };
  }
  const [context, conversation, lastMinute, lastDay] = loaded;
  if (!context)
    return {
      ok: false as const,
      status: 400,
      state: { status: "error" as const, message: NO_PROFILE_MESSAGE },
    };
  if (lastMinute >= COACH_LIMITS.perMinute) {
    return {
      ok: false as const,
      status: 429,
      state: refusal(text, RATE_MINUTE_MESSAGE),
    };
  }
  if (lastDay >= COACH_LIMITS.perDay) {
    return {
      ok: false as const,
      status: 429,
      state: refusal(text, RATE_DAY_MESSAGE),
    };
  }
  // Synchronous, so of several sends in flight only the first ones get through.
  const refused = coachAttempts.take(userId);
  if (refused)
    return {
      ok: false as const,
      status: 429,
      state: refusal(text, RATE_MESSAGES[refused]),
    };

  return { ok: true as const, context, conversation };
}
