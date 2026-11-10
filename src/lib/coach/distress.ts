// The check-in layer of the safety screen (D15): exaggeration tied to a session, distress with no training context, and a catch-all.
// "I'm gonna die on this run" is how people talk about hard sessions, so it gets a short
// check-in that still names 9-8-8, not the full crisis reply. It counts as exaggeration
// only when the phrase is tied to the session ("die on this run", "leg day makes me
// want to die") and nothing in the message states intent ("decided", "pills",
// "tonight"); "after class I'm going to kill myself" stays a crisis. "I feel so
// hopeless" with nothing about training gets the same check-in, and so does any
// message with crisis words that would otherwise get the off-topic redirect.

// Things a session is about. Words that also name ordinary life ("class", "session",
// "bike", "stairs") are left out, so they do not soften a crisis message.
const EXERCISE =
  "(run|runs|running|jog|sprints?|hill|hills|set|sets|reps?|squats?|deadlifts?|bench|lift|lifts|workout|wod|leg day|arm day|cardio|stair ?master|treadmill|intervals?|race|marathon|\\d+k|\\d{3}s|burpees?|planks?|spin class|training)";
const EXERCISE_CONTEXT = new RegExp(`\\b${EXERCISE}\\b`, "i");

// Exaggeration tied to the session, in the three shapes a coach hears.
const TIED = new RegExp(
  [
    `(gonna|going to|about to|could|will|might|want to|wanna) (die|kill myself)( \\w+){0,2} (on|doing|during|at|in|from|after)( \\w+){0,2} ${EXERCISE}\\b`,
    `${EXERCISE}( \\w+){0,4} (makes? me want to die|is (gonna|going to) kill me|i'?m (gonna|going to) die)`,
    `\\bkms (lol|lmao|haha)`,
  ].join("|"),
  "gi",
);

// Anything that states intent, a plan or a means keeps a message a crisis.
const INTENT =
  /\b(decided|tonight|tomorrow|plan(ning|ned)?|set a date|pills?|rope|gun|knife|knives|blade|razor|hang|overdose|note|letter|ready|seriously|not joking|for real|therap(y|ist))\b/i;

// Hopelessness and burden with nothing about training. Explicit wishes to die or not
// exist are crisis wording in guardrails.ts, not here.
const DISTRESS =
  /\b(hopeless\w*|(my )?life (is|feels) (pointless|meaningless|empty)|i'?m (such )?a burden|(a|such a) burden to (everyone|everybody|my family|people)|what'?s the point of anything|nothing matters anymore|can'?t do this anymore|can'?t take it anymore|give up on everything|want to disappear)\b/i;

// Words that should never get the off-topic redirect.
const CRISIS_WORDS =
  /\b(die|dying|death|dead|suicid\w*|kill|end it|ending it|be over|goodbye|gone|pills|overdos\w*|rope|gun|bridge|jump|wrists?|hopeless\w*|worthless|can'?t take it|no way out|give up)\b/i;

function tiedExaggeration(message: string): boolean {
  TIED.lastIndex = 0;
  const found = TIED.test(message) && !INTENT.test(message);
  TIED.lastIndex = 0;
  return found;
}

/** The message with session-tied exaggeration removed, for the crisis word list. */
export function withoutExaggeration(message: string): string {
  return tiedExaggeration(message) ? message.replace(TIED, " ") : message;
}

// Distress strong enough that a training word next to it does not make it training talk.
const STRONG_DISTRESS =
  /\b(i'?m (such )?a burden|(a|such a) burden to (everyone|everybody|my family|people)|can'?t (do|take) (this|it) anymore|want to disappear|nothing matters anymore|what'?s the point of anything)\b/i;

/** Distress wording that gets the check-in before any other reply (it names 9-8-8). */
export function distressCheckIn(message: string): boolean {
  if (STRONG_DISTRESS.test(message)) return true;
  return !EXERCISE_CONTEXT.test(message) && DISTRESS.test(message);
}

/** True when the message should get the check-in rather than the full crisis reply. */
export function needsCheckIn(message: string): boolean {
  return tiedExaggeration(message) || distressCheckIn(message);
}

/** True when a message the coach would redirect as off-topic carries crisis words. */
export function hasCrisisWords(message: string): boolean {
  return CRISIS_WORDS.test(message);
}
