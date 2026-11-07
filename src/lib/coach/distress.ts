// The check-in layer of the safety screen (D15): exaggeration in training talk and distress with no training context.
// "I'm gonna die on this run" is how people talk about hard sessions, so it gets a short
// check-in that still names 9-8-8, not the full crisis reply. "I feel so hopeless" with
// nothing about training gets the same check-in. Explicit crisis wording is caught
// first by the word list in guardrails.ts, and the model check can raise either.

// Words that place a message in a training session.
const EXERCISE_CONTEXT =
  /\b(run\w*|ran|jog\w*|sprint\w*|set|sets|rep|reps|hill\w*|squat\w*|deadlift\w*|bench\w*|lift\w*|workout\w*|work ?out|gym|leg day|arm day|cardio|stair ?master|stairs|treadmill|bike|spin|class|interval\w*|race|marathon|\d+k|\d{3}s|burpee\w*|plank\w*|wod|session|training)\b/i;

// The phrases a coach hears after a hard set; matched only with training context.
const EXAGGERATION =
  /\b((gonna|going to|about to|could|will|might|want to|wanna) (die|kill myself)|kill(ing|ed)? myself|feel(ing)? like dying|(?<!\d\s?)kms)\b/gi;

// Hopelessness and burden with nothing about training. Explicit wishes to die or not
// exist are crisis wording in guardrails.ts, not here.
const DISTRESS =
  /\b(hopeless\w*|(my )?life (is|feels) (pointless|meaningless|empty)|i'?m (such )?a burden|(a|such a) burden to (everyone|everybody|my family|people)|what'?s the point of anything|nothing matters anymore|can'?t do this anymore|give up on everything|want to disappear)\b/i;

/** The message with training-context exaggeration removed, for the crisis word list. */
export function withoutExaggeration(message: string): string {
  return EXERCISE_CONTEXT.test(message)
    ? message.replace(EXAGGERATION, " ")
    : message;
}

/** True when the message should get the check-in rather than the full crisis reply. */
export function needsCheckIn(message: string): boolean {
  const exercise = EXERCISE_CONTEXT.test(message);
  EXAGGERATION.lastIndex = 0;
  if (exercise && EXAGGERATION.test(message)) {
    EXAGGERATION.lastIndex = 0;
    return true;
  }
  EXAGGERATION.lastIndex = 0;
  return !exercise && DISTRESS.test(message);
}
