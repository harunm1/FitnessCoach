"use client";

// One exercise's logging area in the session view: progress line, logged sets, rest timer
// and the set form. Sets waiting in the offline queue (D31) are listed and counted, start
// the rest timer and count for the pain stop rule (#92), so the page keeps working without
// a connection.
import { useEffect, useRef, useState } from "react";
import RestTimer from "@/components/RestTimer";
import { unlockAudio } from "@/lib/alerts/browserAlert";
import SetLogForm, { type LoggedSetInput } from "@/components/SetLogForm";
import {
  mergeLoggedSets,
  type ServerSet,
  type SetRow,
} from "@/lib/offline/mergeLoggedSets";
import {
  sessionSetQueue,
  useSessionSetQueue,
} from "@/lib/offline/sessionSetQueue";
import { firstStoppedSet } from "@/lib/offline/stoppedSet";
import { formatWeight, type WeightUnit } from "@/lib/units/convert";
import { createTapGuard, DOUBLE_TAP_WINDOW_MS } from "@/lib/offline/tapGuard";

type ExerciseLogPanelProps = {
  workoutId: number;
  exerciseId: string;
  exerciseName: string;
  equipment: string | null;
  plannedSets: number;
  targetReps: number;
  restSeconds: number;
  serverSets: ServerSet[];
  lastLoggedAtIso: string | null; // newest saved set, server clock
  serverNowIso: string;
  weightUnit: WeightUnit; // display unit (D30); stored and queued weights are kg
};

function SetRowItem({ row, unit }: { row: SetRow; unit: WeightUnit }) {
  return (
    <li
      className={`list-none border px-2 py-1 text-sm ${row.queued ? "border-dashed border-amber-800/50 bg-amber-50 text-amber-950" : "border-foreground/15 bg-white text-foreground/70"}`}
    >
      Set {row.setNumber}: {row.reps} reps
      {row.weightKg !== null &&
        ` · ${formatWeight(Number(row.weightKg), unit)}`}
      {row.painDuringSession !== null &&
        ` · pain ${row.painDuringSession}/10 during`}
      {row.painNextMorning !== null &&
        ` · pain ${row.painNextMorning}/10 this morning before workout`}
      {row.queued && (
        <span className="text-xs font-semibold">
          {row.error ? " · Not synced" : " · Waiting to sync"}
        </span>
      )}
    </li>
  );
}

export default function ExerciseLogPanel(props: ExerciseLogPanelProps) {
  const queue = useSessionSetQueue();
  const [allowTap] = useState(() => createTapGuard());
  // Log set stays disabled for a moment after a set is stored, so a second tap of a
  // double tap lands on a disabled button instead of logging the next set.
  const [coolingDown, setCoolingDown] = useState(false);
  const cooldown = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(cooldown.current), []);
  const pending = queue.items.filter(
    (item) =>
      item.workoutId === props.workoutId &&
      item.exerciseId === props.exerciseId,
  );
  const merged = mergeLoggedSets(props.serverSets, pending, props.plannedSets);
  const stoppedSet = firstStoppedSet(merged.rows);

  // A queued set has only the device's clock, so it starts a full rest from when it was
  // logged; saved sets keep the server-clock rule of RestTimer.
  const queuedAtIso =
    merged.latestQueuedAt === null
      ? null
      : new Date(merged.latestQueuedAt).toISOString();
  const timerLastIso = queuedAtIso ?? props.lastLoggedAtIso;
  const timerNowIso = queuedAtIso ?? props.serverNowIso;

  const logSet = async (set: LoggedSetInput) => {
    if (!allowTap()) return;
    // A tap is the moment the browser lets the rest-end tone start later (D36).
    unlockAudio();
    setCoolingDown(true);
    window.clearTimeout(cooldown.current);
    cooldown.current = window.setTimeout(
      () => setCoolingDown(false),
      DOUBLE_TAP_WINDOW_MS,
    );
    await sessionSetQueue.enqueue({
      ...set,
      workoutId: props.workoutId,
      exerciseId: props.exerciseId,
    });
  };

  return (
    <>
      <p className="mt-3 mb-0 text-xs font-medium text-foreground/70">
        {merged.loggedCount} / {props.plannedSets} sets logged
        {merged.remaining > 0
          ? ` · ${merged.remaining} remaining`
          : " · Complete"}
      </p>
      {merged.rows.length > 0 && (
        <>
          <ul
            aria-label={`${props.exerciseName} logged sets`}
            className="mt-2 flex flex-wrap gap-2 p-0"
          >
            {merged.rows.map((row) => (
              <SetRowItem key={row.key} row={row} unit={props.weightUnit} />
            ))}
          </ul>
          {timerLastIso && timerNowIso && (
            <RestTimer
              exerciseName={props.exerciseName}
              lastLoggedAtIso={timerLastIso}
              restSeconds={props.restSeconds}
              serverNowIso={timerNowIso}
            />
          )}
        </>
      )}
      {(merged.remaining > 0 || stoppedSet) && (
        <SetLogForm
          // A new key after every logged set resets the pain fields (as on main, #92).
          key={`${props.exerciseId}-${merged.rows.map((row) => `${row.setNumber}:${row.painDuringSession}:${row.painNextMorning}`).join(",")}`}
          blocked={Boolean(stoppedSet)}
          busy={coolingDown}
          correction={
            stoppedSet
              ? {
                  setNumber: stoppedSet.setNumber,
                  reps: stoppedSet.reps,
                  weightKg: stoppedSet.weightKg,
                  painDuringSession: stoppedSet.painDuringSession,
                  painNextMorning: stoppedSet.painNextMorning,
                }
              : undefined
          }
          equipment={props.equipment}
          exerciseId={props.exerciseId}
          nextSetNumber={merged.nextSetNumber}
          targetReps={props.targetReps}
          weightUnit={props.weightUnit}
          onLog={logSet}
        />
      )}
    </>
  );
}
