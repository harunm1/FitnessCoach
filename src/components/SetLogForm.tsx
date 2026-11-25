"use client";

import { useActionState, useState } from "react";
import { logSet } from "@/app/session/actions";
import { painTrafficLight } from "@/lib/coach/painTrafficLight";
import type { SetLogActionState } from "@/lib/workout/setLogSchema";
import { weightPlaceholder } from "@/lib/workout/weightPlaceholder";

type SetLogFormProps = {
  exerciseId: string;
  targetReps: number;
  nextSetNumber: number;
  equipment?: string | null; // the exercise's equipment, for the weight field's hint
  blocked?: boolean;
};

export default function SetLogForm({
  exerciseId,
  targetReps,
  nextSetNumber,
  equipment = null,
  blocked = false,
}: SetLogFormProps) {
  const initialState: SetLogActionState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(
    logSet.bind(null, exerciseId),
    initialState,
  );
  const [painDuringSession, setPainDuringSession] = useState("");
  const [painNextMorning, setPainNextMorning] = useState("");

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
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
      <input name="setNumber" type="hidden" value={nextSetNumber} />
      <label className="grid gap-1 text-sm font-semibold text-foreground/60">
        REPS
        <input
          className="h-10 w-20 border border-foreground/20 bg-white px-2 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          defaultValue={targetReps}
          max={30}
          min={1}
          name="reps"
          required
          type="number"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground/60">
        KG
        <input
          className="h-10 w-24 border border-foreground/20 bg-white px-2 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          inputMode="decimal"
          max={9999.99}
          min={0.01}
          name="weightKg"
          placeholder={weightPlaceholder(equipment)}
          step="0.01"
          type="number"
        />
      </label>
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
        Pain next morning
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
      <p className="basis-full text-xs text-foreground/60">
        Record next-morning pain at the start of the next session, then update
        this set if it is still available.
      </p>
      {blocked && (
        <p
          role="alert"
          className="basis-full border-l-2 border-red-700 px-3 py-2 text-sm text-red-800"
        >
          This exercise is blocked because a logged pain score reached 6/10 or
          higher.
        </p>
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
        disabled={isPending || blocked}
        type="submit"
      >
        {isPending ? "Saving..." : `Log set ${nextSetNumber}`}
      </button>
      {state.message && (
        <p
          aria-live="polite"
          className={`basis-full text-xs ${
            state.status === "error" ? "text-red-800" : "text-foreground/70"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
