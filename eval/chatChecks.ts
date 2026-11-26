// Checks for one chat reply (#142), the code side of the chat prompt's two rules: answers
// are at most 4 sentences (the minimum of 2 is not checked), under 80 words (80 itself is flagged), unless the user asks for
// more; and recovery, pain or nutrition lines appear only when the user's message raised
// that topic. Word lists, so a screen: a hit needs a human read and a clean result is not
// proof. Sentences are counted by end marks, so a bulleted reply is limited by its word
// count only. Rest time between sets is not flagged, although the prompt forbids
// unrequested rest-time advice: the plan itself gives rest, and the eval context carries
// none, so a rest time in a reply needs a human read.
// Pure: no model, no network. eval/chatEval.ts feeds it live replies.
import type { CoachContext } from "../src/lib/coach/chat";

// The prompt says "under 80 words", so a reply of this many words or more is too long.
export const MAX_REPLY_WORDS = 80;
export const MAX_REPLY_SENTENCES = 4;

export type Topic = "recovery" | "pain" | "nutrition";
export type Violation =
  | "too-many-words"
  | "too-many-sentences"
  | `unrequested-${Topic}`
  // D43: a number in no tool result, plan line or user message; a claim that the coach
  // cannot see the user's data; a number the case says the reply must give, missing.
  | "ungrounded-number"
  | "claims-no-access"
  | "missing-cite"
  // D43: none of the case's period phrases ("90 days") is in the reply.
  | "missing-period";

const NOTICE_PATTERNS: Record<Topic, RegExp> = {
  // Matches "aim for 48 h of light activity", "take a rest day", "deload week", "mind the soreness", "ice your elbow"; not "Rest 90 seconds between sets" or "within 2 hours of waking".
  recovery:
    /\brecover(?:y|ing)?\b|\blight activity\b|\b\d+\s?(?:h|hours?)\s+(?:of\s+)?(?:rest|recovery|light|off)\b|\btake (?:a |an |one |two |\d+ )?(?:rest days?|deload)\b|\brest (?:a|one|two) days?\b|\bdeload week if\b|\bsore(?:ness)?\b|\bice\b|\bsleep\b/i,
  // Matches "joint pain", "if it hurts, stop", "see a professional", "consult a doctor", "discomfort"; not "keep your elbows tucked".
  pain: /\bpain\b|\bit hurts\b|\bhurts when\b|\bdiscomfort\b|\binjur(?:y|ies|ed)\b|\bsee a (?:doctor|physio\w*|professional)\b|\bconsult (?:a|your) (?:doctor|physio\w*|professional)\b|\bnumbness\b/i,
  // Matches "protein", "calories", "eat well", "enough food", "stay hydrated", "fuel up", "carbs"; not "keep the bar close".
  nutrition:
    /\bprotein\b|\bcalor(?:ie|ies)\b|\bdiet(?:itian)?\b|\bnutrition\b|\bsupplements?\b|\bmeals?\b|\bcreatine\b|\beat(?:ing)?\b|\bfood\b|\bcarbs?\b|\bhydrat\w*|\bfuel\b|\bdrink water\b/i,
};

const TOPICS = Object.keys(NOTICE_PATTERNS) as Topic[];

export type ReplyExpectation = {
  raises: Topic[];
  detail?: boolean;
  sources?: string[]; // every text the reply's numbers may come from (groundingSources)
  mustCite?: string[]; // numbers the reply must give, such as "412"
  mustName?: string[]; // period phrases, one of which the reply must contain, such as "90 days"
};

function wordCount(reply: string): number {
  return reply.split(/\s+/).filter(Boolean).length;
}

// A sentence ends at . ! or ? followed by a space or the end, so "2.5 kg" is one.
function sentenceCount(reply: string): number {
  return (reply.match(/[.!?](?=\s|$)/g) ?? []).length;
}

// Numbers in a text, as plain numbers: "1,860" is 1860 and "81.0" is 81. A date counts by its
// parts ("14 Mar 2024" gives 14 and 2024; "2026-11-24" gives 2026, 11 and 24), and a minus
// sign is dropped, so "down 3.2 kg" matches a "-3.2 kg" change.
function numbersIn(text: string): string[] {
  return (
    text.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? []
  ).map((token) => String(Number(token)));
}

// The texts a reply's numbers may come from (D43): the user's message, the plan's lines, the
// days a week, and every tool result's period and lines.
export function groundingSources(
  context: CoachContext,
  message: string,
): string[] {
  return [
    message,
    String(context.daysPerWeek),
    ...context.sessionLines,
    ...(context.toolResults ?? []).flatMap((r) => [r.period, ...r.lines]),
  ];
}

// The numbers in the reply that none of the sources holds, each once, in reply order.
export function ungroundedNumbers(reply: string, sources: string[]): string[] {
  const allowed = new Set(sources.flatMap(numbersIn));
  return [...new Set(numbersIn(reply))].filter((n) => !allowed.has(n));
}

// The numbers a case requires that the reply does not give.
export function missingCites(reply: string, mustCite: string[]): string[] {
  const given = new Set(numbersIn(reply));
  return mustCite.filter((n) => !given.has(String(Number(n))));
}

// "I don't have access to your history", "I can't see your weight entries", "I'm unable to
// view your data": the 25 Nov failure. A word list, so a screen.
const NO_ACCESS =
  /\b(?:i|we)\s*(?:'m|am|do not|don'?t|can'?t|cannot|can not|have no|'m not able to|am not able to)\b[^.?!]{0,30}?\b(?:access|see|view|look at|read)\b/i;

export function claimsNoAccess(reply: string): boolean {
  return NO_ACCESS.test(reply.replace(/[‘’]/g, "'"));
}

function groundingViolations(
  reply: string,
  expected: ReplyExpectation,
): Violation[] {
  return [
    ...(expected.sources && ungroundedNumbers(reply, expected.sources).length
      ? (["ungrounded-number"] as const)
      : []),
    ...(claimsNoAccess(reply) ? (["claims-no-access"] as const) : []),
    ...(missingCites(reply, expected.mustCite ?? []).length
      ? (["missing-cite"] as const)
      : []),
    ...(expected.mustName?.length && !namesPeriod(reply, expected.mustName)
      ? (["missing-period"] as const)
      : []),
  ];
}

// Any of the phrases, ignoring case and the kind of space: a model may write "90 days" with a
// narrow no-break space (U+202F), as Groq did on 26 Nov.
const plain = (text: string) => text.replace(/\s+/gu, " ").toLowerCase();
function namesPeriod(reply: string, phrases: string[]): boolean {
  return phrases.some((phrase) => plain(reply).includes(plain(phrase)));
}

export function checkChatReply(
  reply: string,
  expected: ReplyExpectation,
): Violation[] {
  const length: Violation[] = expected.detail
    ? []
    : [
        ...(wordCount(reply) >= MAX_REPLY_WORDS
          ? (["too-many-words"] as const)
          : []),
        ...(sentenceCount(reply) > MAX_REPLY_SENTENCES
          ? (["too-many-sentences"] as const)
          : []),
      ];
  const notices = TOPICS.filter(
    (topic) =>
      !expected.raises.includes(topic) && NOTICE_PATTERNS[topic].test(reply),
  ).map((topic): Violation => `unrequested-${topic}`);
  return [...length, ...notices, ...groundingViolations(reply, expected)];
}
