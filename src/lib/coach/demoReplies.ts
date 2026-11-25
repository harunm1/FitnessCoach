// Stored coach chat replies for the scripted demo questions (D12, #59); written by scripts/demo-replies.ts.
// Served only in demo mode, only when both providers failed before any sentence was
// shown, and only for the exact text of a scripted question. The chat screen labels
// them as a saved example, and they are never saved to the conversation.
import { createHash } from "node:crypto";
import { buildCoachSystemPrompt, type CoachContext } from "./chat";
import cache from "./demoReplies.json";
import { checkCoachReply } from "./guardrails";
import { isDemoMode } from "./providers";

const DAYS_PER_WEEK = 3;

// The sample profile the stored replies were written for: the first five exercises of
// the gym-3-days demo plan's first day, in the "Name sets x reps" lines the chat
// prompt gets for a real user.
export const DEMO_CHAT_CONTEXT: CoachContext = {
  goal: "MUSCLE",
  level: "INTERMEDIATE",
  daysPerWeek: DAYS_PER_WEEK,
  equipment: ["barbell", "dumbbell", "cable", "machine"],
  injuries: null,
  avoidMuscles: [],
  sessionLines: [
    "Barbell Bench Press - Medium Grip 4 x 8",
    "Barbell Shoulder Press 4 x 8",
    "Incline Dumbbell Press 3 x 10",
    "Side Lateral Raise 3 x 12",
    "Triceps Pushdown 3 x 12",
  ],
};

export type DemoReply = {
  question: string; // as the user sends it (a quick reply's text)
  reply: string; // the checked reply, as the coach streamed it
  model: string; // the model that answered
};

export type DemoReplyCache = {
  promptVersion: string; // CHAT_PROMPT_VERSION when the replies were recorded
  promptFingerprint: string; // chatPromptFingerprint() when the replies were recorded
  recordedOn: string; // YYYY-MM-DD
  replies: DemoReply[];
};

export const DEMO_REPLY_CACHE: DemoReplyCache = cache;

// A hash of the system prompt for the sample profile, so any change to the prompt's
// wording, version bump or not, makes a test ask for a refresh.
export function chatPromptFingerprint(): string {
  return createHash("sha256")
    .update(buildCoachSystemPrompt(DEMO_CHAT_CONTEXT))
    .digest("hex");
}

// Case, outer spaces and runs of spaces are ignored; nothing else is, so a different
// question never matches.
// Any run of whitespace: matches the two spaces in "Swap  this"; "Swap-this" has none.
// https://regex101.com/?regex=%5Cs%2B&testString=Swap%20%20this
const SPACES = /\s+/g;
export function demoReplyKey(text: string): string {
  return text.trim().replace(SPACES, " ").toLowerCase();
}

const byKey = new Map(
  DEMO_REPLY_CACHE.replies.map((r) => [demoReplyKey(r.question), r.reply]),
);

// The stored reply for a scripted question in demo mode, otherwise nothing. A stored
// reply that no longer passes the reply check is not served.
export function demoReplyFor(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (!isDemoMode(env)) return undefined;
  const reply = byKey.get(demoReplyKey(text));
  return reply !== undefined && checkCoachReply(reply).action === "ALLOW"
    ? reply
    : undefined;
}
