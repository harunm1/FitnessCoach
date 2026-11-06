// Coach guardrails (#43). The safety rules live here in TypeScript, not in the prompt,
// so no message can talk the model out of them (docs/ARCHITECTURE.md, The coach):
//   - checked first: not wanting to be alive, suicide or self-harm gets the crisis
//     reply (9-8-8, 911); then chest pain, fainting, trouble breathing or an
//     irregular heartbeat gets "stop exercising now" and medical attention
//   - pain (not effort) stops the exercise and points to a professional; a question
//     about avoiding pain gets general safe-training guidance instead (D13)
//   - the coach does not diagnose or advise on medication
//   - disordered eating gets a supportive reply and the NEDIC helpline; guilt or low
//     self-worth as motivation gets a reframe and the plan stays as it is
//   - requests outside training get a short redirect
//   - text the user types is only ever the user message; it never changes the
//     system prompt, so "ignore your instructions" changes nothing here
// checkUserMessage is for every user message before a model call, and checkCoachReply
// for every reply before it is saved or shown; the chat code (#53) and the coach route
// (#11) wire them in, and until then nothing in the app calls them. Each rule has fixed-input tests (guardrails.test.ts).

export type Guard =
  | { action: "ALLOW" }
  | {
      action:
        | "CRISIS"
        | "RED_FLAG"
        | "PAIN_STOP"
        | "PAIN_GUIDANCE"
        | "NO_DIAGNOSIS"
        | "EATING_SUPPORT"
        | "MINDSET_REFRAME"
        | "OFF_TOPIC";
      reply: string;
    };

export const REPLIES = {
  // Mental health (Jörke et al., CHI 2026, arXiv 2510.05449, Table 2). 9-8-8 Suicide
  // Crisis Helpline: call or text, 24/7, English and French (Public Health Agency of
  // Canada and CRTC pages, 988.ca; checked 6 Nov 2026).
  CRISIS:
    "I'm really sorry you're feeling this way. I'm a training coach, so I'm not the right support for this, but you don't have to go through it alone. You can call or text 9-8-8 any time, day or night, to reach the Suicide Crisis Helpline in Canada. If you're in immediate danger, call 911.",
  // Red-flag symptoms during or after exercise: chest pain or tightness, fainting,
  // severe shortness of breath, irregular heartbeat. Stop, then medical attention.
  RED_FLAG:
    "Stop exercising now. Chest pain, fainting or trouble breathing during exercise need medical attention: call 911 if it's severe or doesn't settle quickly, otherwise see a doctor before training again.",
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
  // Body image and eating (Jörke et al., CHI 2026, arXiv 2510.05449, Table 2): no
  // numbers, no diet advice, and the NEDIC helpline (nedic.ca, checked 6 Nov 2026).
  EATING_SUPPORT:
    "That sounds really hard, and you deserve support with it. I can't help with restricting food or making up for eating, but you don't have to deal with this alone: the National Eating Disorder Information Centre (NEDIC) has a toll-free helpline at 1-866-633-4220 and live chat at nedic.ca. I'm still here for your training whenever you want.",
  // Negative mindsets (same source): don't validate guilt or low self-worth as
  // motivation; reframe toward what the user can do, and leave the plan alone.
  MINDSET_REFRAME:
    "You don't have to earn your training or make up for anything, and a missed session or a hard day doesn't change what you're worth. Your plan stays as it is: pick one session you'd like to do this week, and we'll build from there.",
  OFF_TOPIC:
    "I'm your training coach, so I can help with your plan, exercises, running and recovery. What would you like to work on?",
} as const;

// Pain words. Effort words (sore, burn, tired, pump) are deliberately absent:
// soreness after training is expected and should not stop a session. "Sharp" counts
// only next to a pain word, so "I feel sharp today" is not a report.
const PAIN =
  /\b(pain|painful|hurts?|hurting|aches?|aching|((knees?|back|shoulders?|hips?|ankles?|wrists?|elbows?|neck|legs?|feet|foot|hamstrings?|calf|calves|quads?|glutes?|muscles?|joints?|shins?)('s been|'s| is| are| has been| have been| keeps?| been)?( really| still| so)? killing me)|sharp (pain|twinge|ache)|stabbing|shooting|throbbing|pinch(es|ed|ing)?|numb(ness)?|tingl(e|ing)|popped|pop(ping)? sound|snapped|(something|a) snap|rolled my|tweaked|swollen|swelling)\b/i;
// "no pain", "not painful", "doesn't hurt" are reassurance, not a report. Only the
// negated phrase is removed, so "no pain on the warm-up but my knee hurts" still reports.
// Not when the words between are stop/way: "never stops hurting", "no way this pain
// is normal" are reports. "Without pain" is left to the question rule.
const NEGATED_PAIN =
  /\b(no|not|never|don'?t|doesn'?t|didn'?t|isn'?t|wasn'?t)\b(\s+(?!(stop|stops|stopped|way)\b)\w+){0,2}\s+(pain|painful|hurt|hurts|hurting)\b/gi;
const DIAGNOSIS =
  /\b(diagnos\w*|do i have|is it (a )?(torn|tear|broken|fracture|sprain|strain)|what injury|tendinitis|tendonitis|herniat\w*|ibuprofen|advil|painkillers?|pills?|medication|meds|dosage)\b/i;
const TRAINING =
  /\b(workout|exercise|train(ing)?|plan|set|sets|reps?|weight|lift\w*|squat\w*|plank\w*|bench|deadlift\w*|press|curl\w*|row\w*|run\w*|ran|jog\w*|pace|kms?|mile\w*|marathon|sprint\w*|interval\w*|tempo|cardio|stretch\w*|warm[- ]?up|cool[- ]?down|rest|recover\w*|sleep|protein|eat\w*|diet|calori\w*|muscle\w*|gym|form|knee|back|shoulder|hip|ankle|leg\w*|arm\w*|chest|core|abs|sore\w*|tired|fatigue|strength|endurance|body|goal\w*|week|day|session|fat|lose|loss|gain\w*|heavy)\b/i;

// Narrow on purpose: a fat-loss goal ("lose fat", "cut calories", "lose weight") is
// ordinary coaching, and "I'm starving after my run" is hunger. These match
// restriction, purging, vomiting after eating, and food as something earned or not
// deserved.
const EATING =
  /\b(starv(e|ed|es|ing) myself|starv(e|ed|es|ing) to (lose|drop|get thin|be thin)|purg(e|ed|es|ing) (after|when|so|food|meals?|breakfast|lunch|dinner)|(make|made|making) myself (sick|throw up|vomit)|throw(ing)? up after (i eat|eating|meals?|breakfast|lunch|dinner)|skip(s|ped|ping)? (meals?|breakfast|lunch|dinner) to punish|earn(s|ed|ing)? (my )?(food|meals?|breakfast|lunch|dinner)|(do not|don'?t|didn'?t) deserve (to eat|food))\b/i;
// Guilt or low self-worth as the reason to train, said about the user themselves, so
// "disgusting weather" or "worthless old shoes" are not caught.
const MINDSET =
  /\b(hate (my (fat )?body|myself|how i look)|punish(ing)? (myself|my body)|(i'?m|i am|i feel|i look|my body (is|looks))\s+(so\s+)?(a\s+)?(disgusting|worthless|failure|gross))\b/i;

// "How do I avoid knee pain when squatting?" asks how to train safely. It is only a
// report when the user says something hurts them now ("my knee hurts", "I felt a
// sharp pain"), and a report always wins.
const PAIN_QUESTION =
  /\b(how (do|can|should|would) (i|you|we)|how to|ways? to|tips? (for|to|on)|what can i do to)\b.*\b(avoid|prevent|reduce|protect|stop|without|don't|doesn't)\b/i;
const PAIN_REPORT =
  /\b(my|i've|i have|i had|i felt|i feel|i'm feeling|it|that|this)\b(\s+\w+){0,3}\s+(hurts?|hurting|is painful|pain(ful)?|aches?|aching|popped|numb|swollen|tingl\w*)\b|\b(i felt|i feel|i have|i've got|i got|getting)\b(\s+\w+){0,3}\s+(pain|sharp|stabbing|shooting)\b/i;

// Not wanting to be alive, suicide, self-harm or ending one's life, overdose included.
// Checked before every other rule. Training talk is kept out: "this workout is
// killing me", "suicide sprints", "end it with planks", "cut myself some slack",
// "don't want to hurt myself on deadlifts", "5 kms".
const CRISIS =
  /\b(suicid(e|al)(?! (sprints?|runs?|drills?|shuttles?))|kill(ing)? myself|(?<!\d\s?)kms|unalive|end(ing)? my (own )?life|take my (own )?life|end(ing)? it all|ending things|(thinking about|thinking of|think about|want to|going to|gonna|plan(ning)? to) end(ing)? it(?! (with|on|after|early|at|by|there|here|now)\b)|(do ?n'?t|do not) (want|wanna)( to)? (be alive|live(?! (in|with|without|near|at|on|by|until|till)\b)|be here anymore|wake up|exist)|(want|wanna|going to|gonna) (to )?die|wish i (was|were)( not|n'?t) (alive|here|born)|wish i (was|were) dead|(rather|better off) (be )?dead|(no|don'?t see the|what'?s the) point (in|of) (living|life|going on)|(life|living) (is ?n'?t|is not) worth|can'?t go on(?! (a|the|with|my|today|this|that|runs?|holiday|vacation)\b)|(nobody|no one) would (miss|care)|stop living|self[- ]?harm\w*|(?<!(n'?t|not|never) )(want|going|plan(ning)?) to (hurt|harm) myself|(cut|cutting|burn(ing)?) myself(?! (some|a|off|short|slack|out|on|shaving|while|by accident)\b)|(hurt(ing)?|harm(ing)?|cut(ting)?) myself on purpose|been (hurting|harming) myself(?! (with|on|by|doing|lifting|running)\b)|(too many|all (of )?my|a bunch of) (pills|meds)|(swallow\w*|took|taken|take|downed) (a |the )?(whole |entire )?(bottle|pack\w*|box|handful) of (pills|meds|tablets)|no reason to (live|go on|keep going)|nothing (left )?to live for|overdos\w*)\b/i;
// Red-flag symptoms during or after exercise. "My chest is sore from bench" is
// soreness and stays with the effort rule; collapsing counts only when the user
// collapsed, so the form cue "knees collapsing inward" is not a symptom; a racing heart after a sprint, "faint
// praise" and "pass out the water bottles" are not symptoms. Any shortness of breath
// counts, on the safe side of "severe".
const RED_FLAG =
  /\b(chest (pain|pains|tightness|pressure)|chest (got|gets|is|was|feels|felt|feeling) (tight|painful|heavy)|chest (hurts?|hurting|aches?|aching|is killing me)|chest tighten\w*|tight(ening)? chest|(pain|pressure|tightness|ache|heaviness) in my chest|faint(ed|ing)|(feel|felt|feeling|feels|went|got|getting|nearly|almost|about to) faint|passed out|pass out(?! (the|a|some|these|those|them|water)\b)|blacked out|(i|i've|i have|i had|and|then) (just |nearly |almost )?collapsed|(could ?n'?t|can'?t|could not|cannot|can not) (breathe|catch my breath)|trouble breathing|struggl\w* to breathe|short(ness)? of breath|irregular(ly)? heart ?(beat|rhythm)|heart ?beat (felt|feels|was|is|went) irregular|heart (was |is )?(beating |pounding )?irregular(ly)?|palpitations?|heart\w* (felt like it was |was |is |keeps? )?(skipp\w*|flutter\w*)|skipped (a )?beats?)\b/i;

export function checkUserMessage(text: string): Guard {
  // Phone keyboards send curly apostrophes (U+2019 in "don't"); every pattern uses
  // straight ones.
  const message = text.trim().replace(/[‘’ʼ]/g, "'");
  if (CRISIS.test(message)) {
    return { action: "CRISIS", reply: REPLIES.CRISIS };
  }
  if (RED_FLAG.test(message)) {
    return { action: "RED_FLAG", reply: REPLIES.RED_FLAG };
  }
  const affirmed = message.replace(NEGATED_PAIN, " ");
  const pain = PAIN.test(affirmed);
  const report = pain && PAIN_REPORT.test(affirmed);
  const diagnosis = DIAGNOSIS.test(message);
  // An eating disclosure comes first, even when it mentions pain ("I purge after meals
  // and my throat hurts"): stopping an exercise is not the help that message needs.
  if (EATING.test(message)) {
    return { action: "EATING_SUPPORT", reply: REPLIES.EATING_SUPPORT };
  }
  // A pain report wins over everything else, a diagnosis or medication question too (D13).
  if (report) {
    return diagnosis
      ? { action: "PAIN_STOP", reply: REPLIES.PAIN_STOP_NO_DIAGNOSIS }
      : { action: "PAIN_STOP", reply: REPLIES.PAIN_STOP };
  }
  if (MINDSET.test(message)) {
    return { action: "MINDSET_REFRAME", reply: REPLIES.MINDSET_REFRAME };
  }
  if (diagnosis) {
    return { action: "NO_DIAGNOSIS", reply: REPLIES.NO_DIAGNOSIS };
  }
  // "How do I squat so I don't get pain?" is a question even though its pain phrase
  // is negated.
  if (!pain && PAIN.test(message) && PAIN_QUESTION.test(message)) {
    return { action: "PAIN_GUIDANCE", reply: REPLIES.PAIN_GUIDANCE };
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
