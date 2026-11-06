// Coach guardrails (#43). The safety rules live here in TypeScript, not in the prompt,
// so no message can talk the model out of them (docs/ARCHITECTURE.md, The coach):
//   - pain (not effort) stops the exercise and points to a professional; a question
//     about avoiding pain gets general safe-training guidance instead (D13)
//   - the coach does not diagnose or advise on medication
//   - requests outside training get a short redirect
//   - text the user types is only ever the user message; it never changes the
//     system prompt, so "ignore your instructions" changes nothing here
// checkUserMessage runs before every model call; checkCoachReply runs on every reply
// before it is saved or shown. Each rule has fixed-input tests (guardrails.test.ts).

export type Guard =
  | { action: "ALLOW" }
  | {
      action: "PAIN_STOP" | "PAIN_GUIDANCE" | "NO_DIAGNOSIS" | "OFF_TOPIC";
      reply: string;
    };

export const REPLIES = {
  PAIN_STOP:
    "Stop that exercise for today. Pain is different from effort, and it's worth having a physiotherapist or doctor look at it before you load it again. I can swap in a movement that doesn't use that area.",
  // A question about avoiding pain, not a report of it (D13): general, safe
  // programming guidance, clearly not medical advice, no diagnosis.
  PAIN_GUIDANCE:
    "General guidance, not medical advice: warm the area up for a few minutes first, keep to a range of motion that feels comfortable, start lighter and add weight slowly, and follow the form cues on the exercise. If something actually hurts, stop that exercise and have a physiotherapist look at it.",
  NO_DIAGNOSIS:
    "I can't diagnose injuries or advise on medication. A physiotherapist or doctor can. I can help you adjust your plan around it in the meantime.",
  // A pain report that also asks for a diagnosis or a drug: stop first, then decline.
  PAIN_STOP_NO_DIAGNOSIS:
    "Stop that exercise for today. Pain is different from effort, and I can't diagnose injuries or advise on medication; a physiotherapist or doctor can look at it before you load it again. I can swap in a movement that doesn't use that area.",
  OFF_TOPIC:
    "I'm your training coach, so I can help with your plan, exercises, running and recovery. What would you like to work on?",
} as const;

// Pain words. Effort words (sore, burn, tired, pump) are deliberately absent:
// soreness after training is expected and should not stop a session.
const PAIN =
  /\b(pain|painful|hurts?|hurting|sharp|stabbing|shooting|throbbing|pinch(ed|ing)?|numb(ness)?|tingl(e|ing)|popped|pop(ping)? sound|swollen|swelling)\b/i;
// "no pain", "not painful", "doesn't hurt" are reassurance, not a report. Only the
// negated phrase is removed, so "no pain on the warm-up but my knee hurts" still reports.
const NEGATED_PAIN =
  /\b(no|not|without|never|doesn'?t|didn'?t|isn'?t|wasn'?t)\b(\s+\w+){0,2}\s+(pain|painful|hurt|hurts|hurting)\b/gi;
const DIAGNOSIS =
  /\b(diagnos\w*|do i have|is it (a )?(torn|tear|broken|fracture|sprain|strain)|what injury|tendinitis|tendonitis|herniat\w*|ibuprofen|advil|painkillers?|medication|meds|dosage)\b/i;
const TRAINING =
  /\b(workout|exercise|train(ing)?|plan|set|sets|reps?|weight|lift\w*|squat\w*|bench|deadlift\w*|press|curl\w*|row\w*|run\w*|jog\w*|pace|km|mile\w*|marathon|sprint\w*|interval\w*|tempo|cardio|stretch\w*|warm[- ]?up|cool[- ]?down|rest|recover\w*|sleep|protein|eat\w*|diet|calori\w*|muscle\w*|gym|form|knee|back|shoulder|hip|ankle|leg\w*|arm\w*|chest|core|abs|sore\w*|tired|fatigue|strength|endurance|body|goal\w*|week|day|session)\b/i;

// "How do I avoid knee pain when squatting?" asks how to train safely. It is only a
// report when the user says something hurts them now ("my knee hurts", "I felt a
// sharp pain"), and a report always wins.
const PAIN_QUESTION =
  /\b(how (do|can|should|would) (i|you|we)|how to|ways? to|tips? (for|to|on)|what can i do to)\b.*\b(avoid|prevent|reduce|protect|stop|without)\b/i;
const PAIN_REPORT =
  /\b(my|i've|i have|i had|i felt|i feel|i'm feeling|it|that|this)\b(\s+\w+){0,3}\s+(hurts?|hurting|is painful|pain(ful)?|aches?|aching|popped|numb|swollen|tingl\w*)\b|\b(i felt|i feel|i have|i've got|i got|getting)\b(\s+\w+){0,3}\s+(pain|sharp|stabbing|shooting)\b/i;

export function checkUserMessage(text: string): Guard {
  const message = text.trim();
  const affirmed = message.replace(NEGATED_PAIN, " ");
  const pain = PAIN.test(affirmed);
  const report = pain && PAIN_REPORT.test(affirmed);
  const diagnosis = DIAGNOSIS.test(message);
  // A report always wins, also over a diagnosis or medication question (D13).
  if (report) {
    return diagnosis
      ? { action: "PAIN_STOP", reply: REPLIES.PAIN_STOP_NO_DIAGNOSIS }
      : { action: "PAIN_STOP", reply: REPLIES.PAIN_STOP };
  }
  if (diagnosis) {
    return { action: "NO_DIAGNOSIS", reply: REPLIES.NO_DIAGNOSIS };
  }
  if (pain) {
    if (PAIN_QUESTION.test(affirmed)) {
      return { action: "PAIN_GUIDANCE", reply: REPLIES.PAIN_GUIDANCE };
    }
    return { action: "PAIN_STOP", reply: REPLIES.PAIN_STOP };
  }
  // Short messages ("thanks", "ok") are conversation, not off-topic requests.
  const words = message.split(/\s+/).filter(Boolean).length;
  if (words >= 4 && !TRAINING.test(message)) {
    return { action: "OFF_TOPIC", reply: REPLIES.OFF_TOPIC };
  }
  return { action: "ALLOW" };
}

// A model can still slip into diagnosis or dosing. Replies that do are replaced,
// not edited, so nothing half-safe reaches the user.
const REPLY_DIAGNOSIS =
  /\b(you (probably |likely |might |may )?have (a |an )?(torn|tear|sprain|strain|fracture|tendinitis|tendonitis|herniated|bursitis)|(this|that|it) (is|sounds like|could be) (a |an )?(torn|tear|sprain|strain|fracture|tendinitis|tendonitis|herniat\w*|bursitis)|take \d+\s?mg|ibuprofen|advil|naproxen|acetaminophen)\b/i;

export function checkCoachReply(text: string): Guard {
  return REPLY_DIAGNOSIS.test(text)
    ? { action: "NO_DIAGNOSIS", reply: REPLIES.NO_DIAGNOSIS }
    : { action: "ALLOW" };
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// The system prompt is a constant built in code. User text goes in as one user
// message, so nothing the user types becomes an instruction to the model.
export function buildChatMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userText: string,
): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...history.filter((m) => m.role !== "system"),
    { role: "user", content: userText },
  ];
}
