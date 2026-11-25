"use client";

// One exercise's logging area in the session view: progress line, logged sets, rest timer
// and the set form. Sets waiting in the offline queue (D31) are listed and counted, and
// start the rest timer, so the page keeps working without a connection.
import RestTimer from "@/components/RestTimer";
import SetLogForm, { type LoggedSetInput } from "@/components/SetLogForm";
import { mergeLoggedSets, type ServerSet } from "@/lib/offline/mergeLoggedSets";
import {
  sessionSetQueue,
  useSessionSetQueue,
} from "@/lib/offline/sessionSetQueue";

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
};

export default function ExerciseLogPanel(props: ExerciseLogPanelProps) {
  const queue = useSessionSetQueue();
  const pending = queue.items.filter(
    (item) =>
      item.workoutId === props.workoutId &&
      item.exerciseId === props.exerciseId,
  );
  const merged = mergeLoggedSets(props.serverSets, pending, props.plannedSets);

  // A queued set has only the device's clock, so it starts a full rest from when it was
  // logged; saved sets keep the server-clock rule of RestTimer.
  const queuedAtIso =
    merged.latestQueuedAt === null
      ? null
      : new Date(merged.latestQueuedAt).toISOString();
  const timerLastIso = queuedAtIso ?? props.lastLoggedAtIso;
  const timerNowIso = queuedAtIso ?? props.serverNowIso;

  const logSet = (set: LoggedSetInput) =>
    sessionSetQueue.enqueue({
      ...set,
      workoutId: props.workoutId,
      exerciseId: props.exerciseId,
    });

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
              <li
                className={`list-none border px-2 py-1 text-sm ${row.queued ? "border-dashed border-amber-800/50 bg-amber-50 text-amber-950" : "border-foreground/15 bg-white text-foreground/70"}`}
                key={row.key}
              >
                Set {row.setNumber}: {row.reps} reps
                {row.weightKg !== null && ` · ${row.weightKg} kg`}
                {row.queued && (
                  <span className="text-xs font-semibold">
                    {row.error ? " · Not synced" : " · Waiting to sync"}
                  </span>
                )}
              </li>
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
      {merged.remaining > 0 && (
        <SetLogForm
          equipment={props.equipment}
          exerciseId={props.exerciseId}
          nextSetNumber={merged.nextSetNumber}
          targetReps={props.targetReps}
          onLog={logSet}
        />
      )}
    </>
  );
}
