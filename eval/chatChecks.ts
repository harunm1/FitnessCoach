// Checks for one chat reply (#142), the code side of the chat prompt's two rules: answers
// are 2 to 4 sentences, under 80 words, unless the user asks for more; and recovery,
// pain or nutrition lines appear only when the user's message raised that topic.
// Pure: no model, no network. eval/chatEval.ts feeds it live replies.

export const MAX_REPLY_WORDS = 80;
export const MAX_REPLY_SENTENCES = 4;

export type Topic = "recovery" | "pain" | "nutrition";
export type Violation =
  "too-many-words" | "too-many-sentences" | `unrequested-${Topic}`;

// One pattern per topic. Rest between sets is plan content, so "rest" alone is not a
// recovery notice.
const NOTICE_PATTERNS: Record<Topic, RegExp> = {
  // Matches "aim for 48 h of light activity", "recovery day", "get enough sleep"; not "Rest 90 seconds between sets".
  recovery:
    /\brecover(?:y|ing)?\b|\blight activity\b|\b\d+\s?(?:h|hours?)\b|\bsleep\b/i,
  // Matches "joint pain", "see a professional", "injury"; not "keep your elbows tucked".
  pain: /\bpain\b|\binjur(?:y|ies|ed)\b|\bsee a (?:doctor|physio\w*|professional)\b|\bnumbness\b/i,
  // Matches "protein", "calories", "ask a dietitian"; not "keep the bar close".
  nutrition:
    /\bprotein\b|\bcalor(?:ie|ies)\b|\bdiet(?:itian)?\b|\bnutrition\b|\bsupplements?\b|\bmeals?\b|\bcreatine\b/i,
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
        ...(wordCount(reply) > MAX_REPLY_WORDS
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
