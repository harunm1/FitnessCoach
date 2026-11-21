"use client";

import { useActionState, useState } from "react";
import { logSet } from "@/app/session/actions";
import { painTrafficLight } from "@/lib/coach/painTrafficLight";
import type { SetLogActionState } from "@/lib/workout/setLogSchema";

type SetLogFormProps = {
  exerciseId: string;
  targetReps: number;
  nextSetNumber: number;
};

export default function SetLogForm({
  exerciseId,
  targetReps,
  nextSetNumber,
}: SetLogFormProps) {
  const initialState: SetLogActionState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(
    logSet.bind(null, exerciseId),
    initialState,
  );
  const [painDuringSession, setPainDuringSession] = useState("");
  const [painNextMorning, setPainNextMorning] = useState("");

  const duringScore = painDuringSession === "" ? 0 : Number(painDuringSession);
  const morningScore = painNextMorning === "" ? 0 : Number(painNextMorning);
  const traffic =
    Number.isInteger(duringScore) &&
    duringScore >= 0 &&
    duringScore <= 10 &&
    Number.isInteger(morningScore) &&
    morningScore >= 0 &&
    morningScore <= 10
      ? painTrafficLight(duringScore, morningScore)
      : null;
  const stopped = traffic?.state === "stop";

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
      <input name="setNumber" type="hidden" value={nextSetNumber} />
      <label className="grid gap-1 text-[10px] font-semibold text-foreground/60">
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
      <label className="grid gap-1 text-[10px] font-semibold text-foreground/60">
        KG
        <input
          className="h-10 w-24 border border-foreground/20 bg-white px-2 text-sm text-foreground outline-none placeholder:text-foreground/40 focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          inputMode="decimal"
          max={9999.99}
          min={0.01}
          name="weightKg"
          placeholder="Bodyweight"
          step="0.01"
          type="number"
        />
      </label>
      <label className="grid gap-1 text-[10px] font-semibold text-foreground/60">
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
      <label className="grid gap-1 text-[10px] font-semibold text-foreground/60">
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
        disabled={isPending || stopped}
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
