// Checks for one chat reply (#142), the code side of the chat prompt's two rules: answers
// are at most 4 sentences (the minimum of 2 is not checked), under 80 words (80 itself is flagged), unless the user asks for
// more; and recovery, pain or nutrition lines appear only when the user's message raised
// that topic. Word lists, so a screen: a hit needs a human read and a clean result is not
// proof. Sentences are counted by end marks, so a bulleted reply is limited by its word
// count only. Rest time between sets is not flagged, although the prompt forbids
// unrequested rest-time advice: the plan itself gives rest, and the eval context carries
// none, so a rest time in a reply needs a human read.
// Pure: no model, no network. eval/chatEval.ts feeds it live replies.

// The prompt says "under 80 words", so a reply of this many words or more is too long.
export const MAX_REPLY_WORDS = 80;
export const MAX_REPLY_SENTENCES = 4;

export type Topic = "recovery" | "pain" | "nutrition";
export type Violation =
  "too-many-words" | "too-many-sentences" | `unrequested-${Topic}`;

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

export type ReplyExpectation = { raises: Topic[]; detail?: boolean };

function wordCount(reply: string): number {
  return reply.split(/\s+/).filter(Boolean).length;
}

// A sentence ends at . ! or ? followed by a space or the end, so "2.5 kg" is one.
function sentenceCount(reply: string): number {
  return (reply.match(/[.!?](?=\s|$)/g) ?? []).length;
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
  return [...length, ...notices];
}
