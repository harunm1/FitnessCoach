// Fatigue deload rule (#93, D21): propose a lighter week only when two signals agree.
// A pure function over logged sessions, no model call, so it works with the providers down.
// The thresholds are conservative choices with no source yet (D21 marks them unverified).

// Both signals are read over the two latest sessions; older ones do not count.
const SESSIONS_CHECKED = 2;

// RPE 9 is the top of the coach's own target range of 6 to 9 (D17): a session whose
// average logged effort is at or above it left one rep in reserve or fewer.
const HIGH_EFFORT_RPE = 9;

// Both fatigue signals (high effort and missed reps) must agree before a deload is proposed.
const SIGNALS_REQUIRED = 2;

export type LoggedSet = {
  exerciseId: string;
  reps: number;
  rpe: number | null;
};

// One finished session. `plannedReps` maps an exercise id to the reps the plan asked for;
// a lift missing from it cannot be judged and gives no missed-reps signal.
export type SessionLog = {
  sets: LoggedSet[];
  plannedReps: Record<string, number>;
};

export type FatigueSignal = "high-effort" | "missed-reps";

export type DeloadProposal = {
  propose: boolean;
  signals: FatigueSignal[];
  missedExerciseIds: string[];
  message: string;
};

const MESSAGE =
  "Your last two sessions felt very hard and you fell short of the planned reps on the same lift both times. A lighter week may help. It is your choice: nothing changes unless you accept.";

// Average logged RPE of a session, or null when no set carries one.
function averageRpe(session: SessionLog): number | null {
  const rated = session.sets.flatMap((set) =>
    set.rpe === null ? [] : [set.rpe],
  );
  if (rated.length === 0) return null;
  return rated.reduce((sum, rpe) => sum + rpe, 0) / rated.length;
}

// Exercise ids with at least one set below the planned reps.
function missedLifts(session: SessionLog): Set<string> {
  const short = session.sets.filter((set) => {
    const planned = session.plannedReps[set.exerciseId];
    return planned !== undefined && set.reps < planned;
  });
  return new Set(short.map((set) => set.exerciseId));
}

// `sessions` is newest first. Proposes a deload only when both signals fire.
export function proposeDeload(sessions: SessionLog[]): DeloadProposal {
  const none: DeloadProposal = {
    propose: false,
    signals: [],
    missedExerciseIds: [],
    message: "",
  };
  const latest = sessions.slice(0, SESSIONS_CHECKED);
  if (latest.length < SESSIONS_CHECKED) return none;

  const signals: FatigueSignal[] = [];
  const highEffort = latest.every((session) => {
    const average = averageRpe(session);
    return average !== null && average >= HIGH_EFFORT_RPE;
  });
  if (highEffort) signals.push("high-effort");

  const [first, ...rest] = latest.map(missedLifts);
  const missedBoth = [...first].filter((id) =>
    rest.every((lifts) => lifts.has(id)),
  );
  if (missedBoth.length > 0) signals.push("missed-reps");

  const propose = signals.length === SIGNALS_REQUIRED;
  return {
    propose,
    signals,
    missedExerciseIds: propose ? missedBoth : [],
    message: propose ? MESSAGE : "",
  };
}
