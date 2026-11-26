"use client";

// One exercise's set table (D44): Set | Previous | weight | reps | check. A tap on the check
// stores the set in the offline queue (D31), which also starts the exercise's rest timer.
// Rows after the next one are filled from the plan and can be edited before they are logged.
import type { SetRow } from "@/lib/offline/mergeLoggedSets";
import { formatPrevious, type PreviousSet } from "@/lib/workout/previousSets";
import {
  fromKg,
  formatWeight,
  weightLabel,
  type WeightUnit,
} from "@/lib/units/convert";
import type { ExerciseKind } from "@/lib/workout/setTable";

export type SetDraft = { weight: string; reps: string };

type SetTableProps = {
  exerciseName: string;
  kind: ExerciseKind;
  rowCount: number;
  rows: SetRow[]; // logged sets, saved or queued
  nextSetNumber: number;
  previous: PreviousSet[];
  weightUnit: WeightUnit;
  draftFor: (setNumber: number) => SetDraft;
  onDraft: (setNumber: number, draft: SetDraft) => void;
  onLog: (setNumber: number) => void;
  locked: boolean; // blocked by the pain stop rule, or a set was just stored
};

const inputClass =
  "h-10 w-full min-w-0 border border-foreground/20 bg-white px-2 text-sm text-foreground";

export default function SetTable(props: SetTableProps) {
  const { kind, weightUnit } = props;
  const label = weightLabel(weightUnit);
  const numbers = Array.from({ length: props.rowCount }, (_, i) => i + 1);
  return (
    <table
      aria-label={`${props.exerciseName} sets`}
      className="w-full border-collapse text-sm"
    >
      <thead>
        <tr className="text-left text-xs text-foreground/60">
          <th className="py-1 pr-2 font-medium">Set</th>
          <th className="py-1 pr-2 font-medium">Previous</th>
          {kind === "WEIGHT_REPS" && (
            <th className="py-1 pr-2 font-medium">{label}</th>
          )}
          <th className="py-1 pr-2 font-medium">Reps</th>
          <th className="py-1 font-medium">
            <span className="sr-only">Done</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {numbers.map((setNumber) => {
          const logged = props.rows.find((row) => row.setNumber === setNumber);
          const previous = formatPrevious(
            props.previous.find((set) => set.setNumber === setNumber),
            weightUnit,
          );
          if (logged) {
            const weight =
              logged.weightKg === null
                ? null
                : formatWeight(Number(logged.weightKg), weightUnit);
            return (
              <tr
                aria-label={`Set ${setNumber}: ${logged.reps} reps${weight ? ` · ${weight}` : ""}`}
                className="border-t border-foreground/10 bg-foreground/5"
                key={setNumber}
              >
                <td className="py-2 pr-2 font-mono">{setNumber}</td>
                <td className="py-2 pr-2 text-foreground/60">{previous}</td>
                {kind === "WEIGHT_REPS" && (
                  <td className="py-2 pr-2">
                    {logged.weightKg === null
                      ? "-"
                      : fromKg(Number(logged.weightKg), weightUnit)}
                  </td>
                )}
                <td className="py-2 pr-2">{logged.reps}</td>
                <td className="py-2">
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">Set {setNumber} logged</span>
                  {logged.queued && (
                    <span className="ml-1 text-xs font-semibold text-amber-900">
                      {logged.error ? "Not synced" : "Waiting to sync"}
                    </span>
                  )}
                </td>
              </tr>
            );
          }
          const draft = props.draftFor(setNumber);
          const enabled = setNumber === props.nextSetNumber && !props.locked;
          return (
            <tr className="border-t border-foreground/10" key={setNumber}>
              <td className="py-2 pr-2 font-mono">{setNumber}</td>
              <td className="py-2 pr-2 text-foreground/60">{previous}</td>
              {kind === "WEIGHT_REPS" && (
                <td className="py-2 pr-2">
                  <input
                    aria-label={`Weight (${label}) for set ${setNumber}`}
                    className={inputClass}
                    inputMode="decimal"
                    onChange={(event) =>
                      props.onDraft(setNumber, {
                        ...draft,
                        weight: event.target.value,
                      })
                    }
                    type="number"
                    step="0.01"
                    value={draft.weight}
                  />
                </td>
              )}
              <td className="py-2 pr-2">
                <input
                  aria-label={`Reps for set ${setNumber}`}
                  className={inputClass}
                  inputMode="numeric"
                  onChange={(event) =>
                    props.onDraft(setNumber, {
                      ...draft,
                      reps: event.target.value,
                    })
                  }
                  type="number"
                  value={draft.reps}
                />
              </td>
              <td className="py-2">
                <button
                  aria-label={`Log set ${setNumber}`}
                  className="h-10 w-10 border border-foreground/30 text-base font-semibold disabled:opacity-40"
                  disabled={!enabled}
                  onClick={() => props.onLog(setNumber)}
                  type="button"
                >
                  ✓
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
