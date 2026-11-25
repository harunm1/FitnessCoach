"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { logSet } from "@/app/session/actions";
import {
  PAIN_TRAFFIC_THRESHOLDS,
  painTrafficLight,
} from "@/lib/coach/painTrafficLight";
import {
  setLogSchema,
  type SetLogActionState,
} from "@/lib/workout/setLogSchema";
import { weightFieldToKg } from "@/lib/units/input";
import {
  fromKgForEdit,
  weightLabel,
  type WeightUnit,
} from "@/lib/units/convert";
import WeightUnitSwitch from "@/components/WeightUnitSwitch";
import { weightPlaceholder } from "@/lib/workout/weightPlaceholder";

// What the form hands to the offline set queue (D31). The weight is in kilograms, the
// stored unit (D30); the server checks all of it again.
export type LoggedSetInput = {
  clientId: string;
  setNumber: number;
  reps: number;
  weightKg: string | null;
  painDuringSession: number | null;
  painNextMorning: number | null;
};

type SetLogFormProps = {
  exerciseId: string;
  targetReps: number;
  nextSetNumber: number;
  equipment?: string | null; // the exercise's equipment, for the weight field's hint
  blocked?: boolean;
  correction?: {
    setNumber: number;
    reps: number;
    weightKg: string | null;
    painDuringSession: number | null;
    painNextMorning: number | null;
  };
  weightUnit?: WeightUnit; // what the user chose (D30); the form posts it back
  // Given by the session view: the set goes to the offline queue (D31) instead of the
  // logSet action, so a lost connection cannot lose it.
  onLog?: (set: LoggedSetInput) => Promise<void> | void;
  // Set by the session view for a moment after a set is logged, so a double tap cannot
  // land on the next set (D31).
  busy?: boolean;
};

export default function SetLogForm({
  exerciseId,
  targetReps,
  nextSetNumber,
  equipment = null,
  blocked = false,
  correction,
  weightUnit = "KG",
  onLog,
  busy = false,
}: SetLogFormProps) {
  const initialState: SetLogActionState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(
    logSet.bind(null, exerciseId),
    initialState,
  );
  const [painDuringSession, setPainDuringSession] = useState("");
  const [painNextMorning, setPainNextMorning] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const setNumber =
    correcting && correction ? correction.setNumber : nextSetNumber;
  const [queueError, setQueueError] = useState("");
  const [isQueueing, setIsQueueing] = useState(false);
  // One clientId per set attempt, kept until the set is stored, so a retry of the same
  // attempt cannot become a second set.
  const attempt = useRef<{ setNumber: number; clientId: string } | null>(null);

  function clientIdFor(number: number): string {
    if (attempt.current?.setNumber !== number) {
      attempt.current = { setNumber: number, clientId: crypto.randomUUID() };
    }
    return attempt.current.clientId;
  }

  async function handleQueuedSubmit(event: FormEvent<HTMLFormElement>) {
    if (!onLog) return;
    // Synchronously, so React does not also run the logSet action (D31).
    event.preventDefault();
    if (isQueueing) return;
    const fields = new FormData(event.currentTarget);
    const parsed = setLogSchema.safeParse({
      setNumber,
      reps: fields.get("reps"),
      // Typed in the unit the form showed; queued in kg, as logSet stores it (D30).
      weightKg: weightFieldToKg(fields.get("weightKg"), weightUnit),
      painDuringSession: fields.get("painDuringSession"),
      painNextMorning: fields.get("painNextMorning"),
    });
    if (!parsed.success) {
      setQueueError(
        parsed.error.issues[0]?.message ?? "Enter valid set details.",
      );
      return;
    }
    setQueueError("");
    setIsQueueing(true);
    try {
      await onLog({
        clientId: clientIdFor(setNumber),
        setNumber,
        reps: parsed.data.reps,
        weightKg:
          parsed.data.weightKg === undefined
            ? null
            : String(parsed.data.weightKg),
        painDuringSession: parsed.data.painDuringSession ?? null,
        painNextMorning: parsed.data.painNextMorning ?? null,
      });
      attempt.current = null;
    } catch {
      setQueueError("Could not keep this set on the device. Try again.");
    } finally {
      setIsQueueing(false);
    }
  }
  const isSaving = isPending || isQueueing || busy;
  const message = onLog
    ? { status: "error" as const, message: queueError }
    : state;

  const duringScore =
    painDuringSession === "" ? null : Number(painDuringSession);
  const morningScore = painNextMorning === "" ? null : Number(painNextMorning);
  const validDuring =
    duringScore === null ||
    (Number.isInteger(duringScore) && duringScore >= 0 && duringScore <= 10);
  const validMorning =
    morningScore === null ||
    (Number.isInteger(morningScore) && morningScore >= 0 && morningScore <= 10);
  const traffic =
    (duringScore !== null || morningScore !== null) &&
    validDuring &&
    validMorning
      ? painTrafficLight(duringScore ?? 0, morningScore ?? 0)
      : null;

  return (
    <form
      // The logSet action stays on the form for a submit before the page is interactive
      // (no JavaScript yet); once hydrated, the queue handler calls preventDefault, which
      // React honours by not running the action.
      action={formAction}
      className="mt-4 flex flex-wrap items-end gap-2"
      onSubmit={onLog ? handleQueuedSubmit : undefined}
    >
      <input name="setNumber" type="hidden" value={setNumber} />
      <input name="weightUnit" type="hidden" value={weightUnit} />
      <label className="grid gap-1 text-sm font-semibold text-foreground/60">
        REPS
        <input
          className="h-10 w-20 border border-foreground/20 bg-white px-2 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          key={`reps-${setNumber}`}
          defaultValue={correcting && correction ? correction.reps : targetReps}
          max={30}
          min={1}
          name="reps"
          required
          type="number"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground/60">
        {weightLabel(weightUnit).toUpperCase()}
        <input
          className="h-10 w-24 border border-foreground/20 bg-white px-2 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          inputMode="decimal"
          key={`weight-${setNumber}-${weightUnit}`}
          defaultValue={
            correcting && correction?.weightKg
              ? fromKgForEdit(Number(correction.weightKg), weightUnit)
              : ""
          }
          max={9999.99}
          min={0.01}
          name="weightKg"
          placeholder={weightPlaceholder(equipment, weightUnit)}
          step="0.01"
          type="number"
        />
      </label>
      <WeightUnitSwitch current={weightUnit} />
      <label className="grid gap-1 text-sm font-semibold text-foreground/60">
        Pain during
        <input
          className="h-10 w-20 border border-foreground/20 bg-white px-2 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          max={10}
          min={0}
          name="painDuringSession"
          onChange={(event) => setPainDuringSession(event.target.value)}
          step={1}
          type="number"
          value={painDuringSession}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground/60">
        Pain this morning (before workout)
        <input
          className="h-10 w-20 border border-foreground/20 bg-white px-2 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          max={10}
          min={0}
          name="painNextMorning"
          onChange={(event) => setPainNextMorning(event.target.value)}
          step={1}
          type="number"
          value={painNextMorning}
        />
      </label>
      {blocked && (
        <p
          role="alert"
          className="basis-full border-l-2 border-red-700 px-3 py-2 text-sm text-red-800"
        >
          This exercise is blocked because a logged pain score reached{" "}
          {PAIN_TRAFFIC_THRESHOLDS.stopMin}/10 or higher.
        </p>
      )}
      {blocked && correction && !correcting && (
        <button
          className="min-h-10 border border-foreground/20 px-3 text-sm font-semibold"
          type="button"
          onClick={() => {
            setCorrecting(true);
            setPainDuringSession(
              correction.painDuringSession?.toString() ?? "",
            );
            setPainNextMorning(correction.painNextMorning?.toString() ?? "");
          }}
        >
          Correct logged set {correction.setNumber}
        </button>
      )}
      {traffic && (
        <p
          aria-live="polite"
          className={`basis-full border-l-2 px-3 py-2 text-xs ${
            traffic.state === "stop"
              ? "border-red-700 text-red-800"
              : traffic.state === "hold"
                ? "border-amber-700 text-amber-800"
                : "border-green-700 text-green-800"
          }`}
          role="status"
        >
          <strong className="capitalize">{traffic.state}</strong>:{" "}
          {traffic.reason}
        </p>
      )}
      <button
        className="h-10 bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
        disabled={isSaving || (blocked && !correcting)}
        type="submit"
      >
        {isSaving
          ? "Saving..."
          : correcting
            ? `Save correction for set ${setNumber}`
            : `Log set ${nextSetNumber}`}
      </button>
      {message.message && (
        <p
          aria-live="polite"
          className={`basis-full text-xs ${
            message.status === "error" ? "text-red-800" : "text-foreground/70"
          }`}
          role={message.status === "error" ? "alert" : "status"}
        >
          {message.message}
        </p>
      )}
    </form>
  );
}
