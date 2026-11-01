"use client";

import { useActionState } from "react";
import { logSet } from "@/app/session/actions";
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

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
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
      <button
        className="h-10 bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : `Log set ${nextSetNumber}`}
      </button>
      {state.message && (
        <p
          aria-live="polite"
          className={`basis-full text-xs ${state.status === "error" ? "text-red-800" : "text-foreground/70"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
