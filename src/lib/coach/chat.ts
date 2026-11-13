// One coach chat turn (#11). The order is fixed in code, the same way the plan path
// is (docs/ARCHITECTURE.md, The coach):
//   1. an empty or over-long message gets a fixed reply; otherwise the message goes
//      through the safety screen (a model check that can only raise the response,
//      then the word list, D15), and a crisis, red-flag, check-in, pain, diagnosis,
//      eating, self-worth, nutrition or off-topic message gets its fixed reply with no
//      chat call; a short follow-up to a training turn ("Can you explain that?") is not
//      off-topic, but only that redirect is relaxed, every other check still runs
//   2. the model sees a system prompt built here from the user's own plan and
//      profile, then the conversation, then the new message as a user message
//   3. the reply goes through checkCoachReply before anyone sees it
//   4. if no provider answers, the user gets a short fixed reply and the rest of the
//      app keeps working (Section 2.5: a failure degrades one capability)
// Each model call writes one coachLog record (#41) with no user text or reply in it;
// a failure is recorded by a provider's own fixed message or by the error's name.
// Only the model call itself is caught: a bug while building the prompt throws.
import {
  okOutcome,
  splitServed,
  writeRecord,
  type CoachSink,
} from "./coachLog";
import {
  buildChatMessages,
  checkCoachReply,
  mentionsTraining,
  REPLIES,
  type ChatMessage,
} from "./guardrails";
import {
  ProviderError,
  type CoachChatModel,
  type ProviderEvent,
} from "./providers";
import { screenUserMessage, type SafetyClassifier } from "./safetyScreen";

export type ChatSource = "COACH" | "GUARDRAIL" | "UNAVAILABLE";

export type CoachTurn = { reply: string; source: ChatSource };

// The same logging options as generatePlan's, so one sink serves both paths.
export type ChatOptions = {
  log?: CoachSink; // one record per model call (#41)
  takeProviderEvents?: () => ProviderEvent[]; // from providerEventCollector
  now?: () => number;
};

export const UNAVAILABLE_REPLY =
  "The coach can't answer right now. Your plan and logging still work; try the chat again in a minute.";

// Only what the coach needs to answer about this user's training. No name, email,
// photo or health detail goes into a prompt (D4; ENGINEERING_PRACTICES.md, item 6).
export type CoachContext = {
  goal: string;
  level: string;
  daysPerWeek: number;
  equipment: string[];
  // The injury text as the user typed it. Never sent to a model (item 6); callers
  // derive avoidMuscles from it in code.
  injuries: string | null;
  // Muscle names from the exercise library that code matched to the injury text, as
  // onboarding does for the plan. Only these reach the prompt.
  avoidMuscles?: string[];
  // Today's or the next session, as short lines such as "Bench press 3 x 10".
  sessionLines: string[];
};

// What the user types is capped before any rule or model sees it
// (ENGINEERING_PRACTICES.md, item 5): a long message slows the guardrail patterns and
// inflates the prompt. 1,000 characters is several paragraphs, far more than a chat
// question needs; older turns past the last 12 messages are dropped.
export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY_MESSAGES = 12;

// Only the first and last 1,000 characters of a long message are screened, so this
// reply names the crisis line itself (security review, 10 Nov).
export const TOO_LONG_REPLY =
  "That message is too long for the coach. Please keep it to 1,000 characters or fewer and ask one thing at a time. If you're going through something hard, you can call or text 9-8-8 any time.";
export const EMPTY_REPLY =
  "Ask me anything about your plan, today's session, running or recovery.";

// A short message that points back at the coach's last answer ("Can you explain
// that?", "why is that?", "tell me more") has no training words of its own. It counts
// as a follow-up only when all three hold, so the off-topic redirect keeps working for
// everything else (review of 10 Nov):
//   - it is short and is, start to end, one of these openers; "ignore that and tell me
//     a joke" or "translate that into French" are not;
//   - the message right before it is the coach's own model reply, about training;
//   - that reply is not one of the app's fixed replies (the crisis, pain, nutrition and
//     off-topic replies all mention "training" or "exercise" and are no context);
//   - in "what do you mean by X", X is words from that reply, so "what do you mean by
//     RPE" after a reply that used RPE is a follow-up and "what do you mean by bitcoin
//     price today" is not (review of 11 Nov); "what do you mean by that" always is.
// The system prompt still limits the model to this user's training, and the reply goes
// through checkCoachReply.
const MAX_FOLLOW_UP_WORDS = 8;
const LEAD = String.raw`(?:(?:ok|okay|so|and|but|hmm)[ ,]+)?`;
// Polite or emphatic words people add at the end; they change nothing about the ask.
const TAIL = String.raw`(?: (?:again|please|exactly))*[ ?.!]*$`;
const FOLLOW_UP = new RegExp(
  [
    String.raw`^${LEAD}(?:(?:can|could|would) you (?:please )?|please )?(?:explain|clarify|elaborate)(?: (?:that|this|it|more|further|again|a bit more|why|how|what you (?:mean|said)))?${TAIL}`,
    String.raw`^${LEAD}(?:why|why is that|why is it|how come|how so|what do you mean(?: by (?<term>[\w'" -]{1,30}?))?|what does (?:that|this|it) mean|tell me more|say more|go on|and then|what about (?:that|this|it|the (?:last|next|first) one))${TAIL}`,
  ].join("|"),
  "i",
);

// The words after "what do you mean by", if any, must appear in the coach's reply.
// "that", "this" and "it" point at the reply as a whole, so they always count.
const POINTS_AT_REPLY: ReadonlySet<string> = new Set(["that", "this", "it"]);
function termFromReply(match: RegExpExecArray, reply: string): boolean {
  // Quotes around the term are the user's, not the coach's.
  const term = match.groups?.term?.replace(/['"]/g, "").trim().toLowerCase();
  return (
    !term || POINTS_AT_REPLY.has(term) || reply.toLowerCase().includes(term)
  );
}

// Everything the app says without asking the model. Compared in full, so a fixed reply
// in the history is never mistaken for the coach talking about training.
const FIXED_REPLIES: ReadonlySet<string> = new Set([
  ...Object.values(REPLIES),
  UNAVAILABLE_REPLY,
  TOO_LONG_REPLY,
  EMPTY_REPLY,
]);

function isFollowUp(text: string, recent: ChatMessage[]): boolean {
  const last = recent.at(-1);
  const match = FOLLOW_UP.exec(text);
  return (
    text.split(/\s+/).filter(Boolean).length <= MAX_FOLLOW_UP_WORDS &&
    match !== null &&
    last?.role === "assistant" &&
    !FIXED_REPLIES.has(last.content) &&
    mentionsTraining(last.content) &&
    termFromReply(match, last.content)
  );
}

// Bump when the wording changes, so logged replies can be grouped by prompt.
// chat-v2 (10 Nov): added the nutrition rule, the same scope as the guardrail in code.
// chat-v3 (11 Nov): the typed injury line is gone; code-chosen muscles to avoid instead.
export const CHAT_PROMPT_VERSION = "chat-v3";

// Profile values (equipment and muscle names) go into the system prompt, so each is
// kept to one short piece of a line: no newlines to start a fake instruction, no
// quotes, and a length cap (ENGINEERING_PRACTICES.md, item 5).
const MAX_PROFILE_TEXT = 200;
function asData(text: string | null): string {
  return (text ?? "")
    .replace(/["\s\u0085]+/g, " ") // \s in JavaScript does not include NEL
    .trim()
    .slice(0, MAX_PROFILE_TEXT);
}

export function buildCoachSystemPrompt(ctx: CoachContext): string {
  const avoid = (ctx.avoidMuscles ?? []).map(asData).filter(Boolean);
  return [
    "You are FitnessCoach, a strength and running coach inside a training app.",
    "Answer only about this user's training, recovery and the session below. Keep replies under 120 words.",
    "Suggest exercise swaps only from movements the user's equipment allows, and say why in one line.",
    "Never diagnose, never name a medication or dose, and if the user reports pain, tell them to stop that exercise and see a professional.",
    "Give no diet, calorie, supplement or meal advice: say it is outside what you coach and suggest a registered dietitian.",
    "",
    `Goal: ${ctx.goal}. Level: ${ctx.level}. Days a week: ${ctx.daysPerWeek}.`,
    `Equipment: ${ctx.equipment.map(asData).filter(Boolean).join(", ") || "body weight only"}.`,
    ...(avoid.length ? [`Muscles to keep load off: ${avoid.join(", ")}.`] : []),
    "Session:",
    ...(ctx.sessionLines.length ? ctx.sessionLines : ["rest day"]),
  ].join("\n");
}

export async function coachReply(
  model: CoachChatModel,
  ctx: CoachContext,
  history: ChatMessage[],
  userText: string,
  // The model safety check (D15); without it the word list decides alone.
  classify?: SafetyClassifier,
  options: ChatOptions = {},
): Promise<CoachTurn> {
  const text = userText.trim();
  if (text === "") return { reply: EMPTY_REPLY, source: "GUARDRAIL" };
  if (text.length > MAX_MESSAGE_CHARS) {
    // Too long to answer, but never too long to screen: the start and the end are
    // checked (a bounded input), so a long message that ends in crisis wording or
    // starts with a symptom or a pain report still gets that reply. Wording only in
    // the middle of a long message is not seen; the length reply asks for less.
    const ends = `${text.slice(0, MAX_MESSAGE_CHARS)} … ${text.slice(-MAX_MESSAGE_CHARS)}`;
    const safety = await screenUserMessage(ends, classify);
    return safety.action === "ALLOW" || safety.action === "OFF_TOPIC"
      ? { reply: TOO_LONG_REPLY, source: "GUARDRAIL" }
      : { reply: safety.reply, source: "GUARDRAIL" };
  }
  // Stored rows with no text are skipped; each turn is rebuilt as role and content.
  const recent = history
    .filter((m) => typeof m.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
    }));

  const guard = await screenUserMessage(text, classify);
  // Only the off-topic redirect is relaxed for an in-context follow-up; crisis,
  // red-flag, pain, diagnosis, eating, self-worth and nutrition replies stand.
  const followUp = guard.action === "OFF_TOPIC" && isFollowUp(text, recent);
  if (guard.action !== "ALLOW" && !followUp) {
    return { reply: guard.reply, source: "GUARDRAIL" };
  }

  // Built before the call, outside its catch: a bug here is the app's, not a provider's.
  const messages = buildChatMessages(buildCoachSystemPrompt(ctx), recent, text);
  return askModel(model, messages, options);
}

// What a failed call is recorded as. A ProviderError's message is a fixed string from
// providers.ts; any other error (a JSON parse error quotes the body it could not read)
// is recorded by name only, so no reply text reaches a record (practice 6).
function errorLabel(e: unknown): string {
  if (e instanceof ProviderError) return e.message;
  return e instanceof Error ? e.name : "unknown error";
}

// The one model call of a turn, its reply check, and its record. The record carries
// labels and timings only, never the messages or the reply.
async function askModel(
  model: CoachChatModel,
  messages: ChatMessage[],
  { log, takeProviderEvents = () => [], now = Date.now }: ChatOptions,
): Promise<CoachTurn> {
  const base = {
    kind: "chat" as const,
    promptVersion: CHAT_PROMPT_VERSION,
    attempt: 1,
  };
  const started = now();
  let reply: string;
  try {
    reply = await model(messages);
  } catch (e) {
    const { served, providerEvents } = splitServed(takeProviderEvents());
    await writeRecord(log, {
      ...base,
      latencyMs: now() - started,
      outcome: "error",
      ...served,
      providerEvents,
      error: errorLabel(e),
    });
    return { reply: UNAVAILABLE_REPLY, source: "UNAVAILABLE" };
  }
  const latencyMs = now() - started;
  const { served, providerEvents } = splitServed(takeProviderEvents());
  const checked = checkCoachReply(reply);
  const ok = checked.action === "ALLOW";
  await writeRecord(log, {
    ...base,
    latencyMs,
    outcome: ok ? okOutcome(1, providerEvents) : "rejected",
    ...served,
    providerEvents,
    ...(ok ? {} : { problems: [`reply check: ${checked.action}`] }),
  });
  return ok
    ? { reply, source: "COACH" }
    : { reply: checked.reply, source: "GUARDRAIL" };
}
