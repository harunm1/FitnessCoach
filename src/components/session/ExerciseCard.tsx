"use client";

// One exercise as a card (D44): a muscle badge, its name, its own rest timer choice, a notes
// line and the set table. Sets go through the offline queue (D31); a logged set starts this
// exercise's rest timer (D37). The pain check-in of the workout rides along with each set,
// and the saved stop rule (#92) blocks the exercise as before.
import { useEffect, useRef, useState } from "react";
import RestTimer from "@/components/RestTimer";
import { unlockAudio } from "@/lib/alerts/browserAlert";
import { mergeLoggedSets, type ServerSet } from "@/lib/offline/mergeLoggedSets";
import {
  sessionSetQueue,
  useSessionSetQueue,
} from "@/lib/offline/sessionSetQueue";
import { firstStoppedSet } from "@/lib/offline/stoppedSet";
import { createTapGuard, DOUBLE_TAP_WINDOW_MS } from "@/lib/offline/tapGuard";
import WeightUnitSwitch from "@/components/WeightUnitSwitch";
import { fromKg, fromKgForEdit, type WeightUnit } from "@/lib/units/convert";
import { weightFieldToKg } from "@/lib/units/input";
import type { PreviousSet } from "@/lib/workout/previousSets";
import { setLogSchema } from "@/lib/workout/setLogSchema";
import {
  MAX_SETS_PER_EXERCISE,
  canAddSet,
  canRemoveSet,
  checkInStops,
  exerciseKind,
  formatRestChoice,
  initialRowCount,
  restChoicesWith,
} from "@/lib/workout/setTable";
import {
  notesKey,
  restKey,
  useDeviceValue,
} from "@/lib/workout/useDeviceValue";
import { useCheckIn } from "./CheckInPanel";
import SetTable, { type SetDraft } from "./SetTable";

type ExerciseCardProps = {
  workoutId: number;
  exerciseId: string;
  exerciseName: string;
  equipment: string | null;
  primaryMuscle: string | null;
  plannedSets: number;
  targetReps: number;
  restSeconds: number; // the plan's rest for this exercise
  serverSets: ServerSet[];
  previous: PreviousSet[];
  lastLoggedAtIso: string | null;
  serverNowIso: string;
  weightUnit: WeightUnit;
  suggestedWeightKg: number | null;
};

export default function ExerciseCard(props: ExerciseCardProps) {
  const queue = useSessionSetQueue();
  const { score, invalid: checkInBad } = useCheckIn(props.workoutId);
  const [restRaw, setRestRaw] = useDeviceValue(restKey(props.exerciseId));
  const [notes, setNotes] = useDeviceValue(
    notesKey(props.workoutId, props.exerciseId),
  );
  const [allowTap] = useState(() => createTapGuard());
  const [coolingDown, setCoolingDown] = useState(false);
  const cooldown = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(cooldown.current), []);
  // One clientId per set attempt, kept until the set is stored, so a retry cannot double it.
  const attempts = useRef(new Map<number, string>());
  const [drafts, setDrafts] = useState<Record<number, SetDraft>>({});
  const [error, setError] = useState("");

  const pending = queue.items.filter(
    (item) =>
      item.workoutId === props.workoutId &&
      item.exerciseId === props.exerciseId,
  );
  const merged = mergeLoggedSets(props.serverSets, pending, props.plannedSets);
  const [extraRows, setExtraRows] = useState(0);
  // The plan's sets plus the rows added or removed here, never fewer than the logged ones.
  const rowCount = Math.min(
    Math.max(
      initialRowCount(props.plannedSets, 0) + extraRows,
      merged.loggedCount,
      1,
    ),
    MAX_SETS_PER_EXERCISE,
  );
  const stoppedSet = firstStoppedSet(merged.rows);
  // A stop-range check-in is stored with the next set, so the server records it and blocks
  // the exercise (#92); a check-in that is not a number waits for the user to fix it.
  const blocked = Boolean(stoppedSet) || checkInBad;
  const stopWarning = checkInStops(score) && !stoppedSet;
  const kind = exerciseKind(props.equipment);

  const choices = restChoicesWith(props.restSeconds);
  const stored = Number(restRaw);
  const restChoice =
    restRaw !== "" && choices.includes(stored) ? stored : props.restSeconds;
  const queuedAtIso =
    merged.latestQueuedAt === null
      ? null
      : new Date(merged.latestQueuedAt).toISOString();
  const timerLastIso = queuedAtIso ?? props.lastLoggedAtIso;
  const timerNowIso = queuedAtIso ?? props.serverNowIso;

  // The row's box values: what was typed, else last time's weight for that set, else the
  // weight lifted lately, with the plan's reps.
  const draftFor = (setNumber: number): SetDraft => {
    const typed = drafts[setNumber];
    if (typed) return typed;
    const before = props.previous.find((set) => set.setNumber === setNumber);
    // A bodyweight exercise starts with no weight: a typed one is weight added to the body.
    if (kind === "REPS_ONLY")
      return { weight: "", reps: String(props.targetReps) };
    const kg =
      before?.weightKg !== undefined && before.weightKg !== null
        ? fromKgForEdit(Number(before.weightKg), props.weightUnit)
        : props.suggestedWeightKg === null
          ? null
          : fromKg(props.suggestedWeightKg, props.weightUnit);
    return {
      weight: kg === null ? "" : String(kg),
      reps: String(props.targetReps),
    };
  };

  const store = async (
    setNumber: number,
    reps: string,
    weight: string,
  ): Promise<void> => {
    const parsed = setLogSchema.safeParse({
      setNumber,
      reps,
      weightKg: weightFieldToKg(weight, props.weightUnit),
      painDuringSession: "",
      painNextMorning: score === null ? "" : String(score),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter valid set details.");
      return;
    }
    setError("");
    const clientId = attempts.current.get(setNumber) ?? crypto.randomUUID();
    attempts.current.set(setNumber, clientId);
    try {
      await sessionSetQueue.enqueue({
        clientId,
        setNumber,
        reps: parsed.data.reps,
        weightKg:
          parsed.data.weightKg === undefined
            ? null
            : String(parsed.data.weightKg),
        painDuringSession: null,
        painNextMorning: parsed.data.painNextMorning ?? null,
        workoutId: props.workoutId,
        exerciseId: props.exerciseId,
      });
      attempts.current.delete(setNumber);
    } catch {
      setError("Could not keep this set on the device. Try again.");
    }
  };

  const logRow = async (setNumber: number) => {
    if (!allowTap()) return;
    // A tap is the moment the browser lets the rest-end tone start later (D37).
    unlockAudio();
    setCoolingDown(true);
    window.clearTimeout(cooldown.current);
    cooldown.current = window.setTimeout(
      () => setCoolingDown(false),
      DOUBLE_TAP_WINDOW_MS,
    );
    const draft = draftFor(setNumber);
    await store(setNumber, draft.reps, draft.weight);
  };

  // Re-stores the stopped set with today's check-in (the update path of the server rule), for
  // a score that was typed wrong.
  const correct = async () => {
    if (!stoppedSet) return;
    await store(
      stoppedSet.setNumber,
      String(stoppedSet.reps),
      stoppedSet.weightKg === null
        ? ""
        : String(fromKgForEdit(Number(stoppedSet.weightKg), props.weightUnit)),
    );
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground/10 text-sm font-semibold uppercase"
        >
          {(props.primaryMuscle ?? props.exerciseName).charAt(0)}
        </span>
        <WeightUnitSwitch current={props.weightUnit} />
        <label className="ml-auto grid gap-1 text-xs text-foreground/60">
          Rest timer
          <select
            className="h-9 border border-foreground/20 bg-white px-2 text-sm text-foreground"
            onChange={(event) => setRestRaw(event.target.value)}
            value={String(restChoice)}
          >
            {choices.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatRestChoice(seconds)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        aria-label={`Notes for ${props.exerciseName}`}
        className="h-10 w-full border-0 border-b border-foreground/15 bg-transparent px-1 text-sm"
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Add notes here (kept on this device)"
        type="text"
        value={notes}
      />
      <SetTable
        draftFor={draftFor}
        exerciseName={props.exerciseName}
        equipment={props.equipment}
        kind={kind}
        locked={blocked || coolingDown}
        nextSetNumber={merged.nextSetNumber}
        onDraft={(setNumber, draft) =>
          setDrafts((all) => ({ ...all, [setNumber]: draft }))
        }
        onLog={logRow}
        previous={props.previous}
        rowCount={rowCount}
        rows={merged.rows}
        weightUnit={props.weightUnit}
      />
      <div className="flex gap-3">
        <button
          className="min-h-10 border border-foreground/25 px-3 text-sm"
          disabled={!canAddSet(rowCount)}
          onClick={() => setExtraRows((n) => n + 1)}
          type="button"
        >
          Add set
        </button>
        <button
          className="min-h-10 border border-foreground/25 px-3 text-sm"
          disabled={!canRemoveSet(rowCount, merged.loggedCount)}
          onClick={() => setExtraRows((n) => n - 1)}
          type="button"
        >
          Remove set
        </button>
      </div>
      {stoppedSet && (
        <p
          className="m-0 border-l-2 border-red-700 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          Logging is blocked because a pain score reached the stop range (6 out
          of 10 or higher).
          {!checkInStops(score) && !checkInBad && (
            <>
              {" "}
              <button className="underline" onClick={correct} type="button">
                Correct logged set {stoppedSet.setNumber}
              </button>
            </>
          )}
        </p>
      )}
      {checkInBad && (
        <p className="m-0 border-l-2 border-red-700 px-3 py-2 text-sm text-red-800">
          Today&apos;s check-in is not a whole number from 0 to 10. Fix it or
          clear it to log sets.
        </p>
      )}
      {stopWarning && (
        <p className="m-0 border-l-2 border-amber-700 px-3 py-2 text-sm text-amber-800">
          Today&apos;s check-in is in the stop range. The next set is saved with
          it and then this exercise is blocked.
        </p>
      )}
      {error && (
        <p className="m-0 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {merged.rows.length > 0 &&
        restChoice > 0 &&
        timerLastIso &&
        timerNowIso && (
          <RestTimer
            exerciseName={props.exerciseName}
            lastLoggedAtIso={timerLastIso}
            restSeconds={restChoice}
            serverNowIso={timerNowIso}
          />
        )}
    </div>
  );
}
