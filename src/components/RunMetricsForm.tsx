"use client";

import { useActionState } from "react";
import { saveRunMetrics } from "@/app/session/actions";
import type { RunMetricsActionState } from "@/lib/workout/runMetricsSchema";

type RunMetricsFormProps = {
  distanceKm: string | null;
  durationSeconds: number | null;
};

export default function RunMetricsForm({
  distanceKm,
  durationSeconds,
}: RunMetricsFormProps) {
  const initialState: RunMetricsActionState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(
    saveRunMetrics,
    initialState,
  );
  const durationMinutes =
    durationSeconds === null ? "" : Math.floor(durationSeconds / 60);
  const remainingSeconds = durationSeconds === null ? "" : durationSeconds % 60;

  return (
    <form
      action={formAction}
      className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end"
    >
      <label className="grid gap-1.5 text-xs font-semibold">
        Distance (km)
        <input
          className="h-11 w-full border border-foreground/20 bg-white px-3 text-sm font-normal outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          defaultValue={distanceKm ?? ""}
          max={9999.99}
          min={0.01}
          name="distanceKm"
          placeholder="e.g. 5.25"
          required
          step="0.01"
          type="number"
        />
      </label>
      <fieldset className="grid grid-cols-2 gap-2 border-0 p-0">
        <legend className="mb-1.5 text-xs font-semibold">Duration</legend>
        <label className="grid gap-1.5 text-[10px] text-foreground/60">
          MINUTES
          <input
            className="h-11 w-full border border-foreground/20 bg-white px-3 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
            defaultValue={durationMinutes}
            max={1440}
            min={0}
            name="durationMinutes"
            placeholder="0"
            required
            type="number"
          />
        </label>
        <label className="grid gap-1.5 text-[10px] text-foreground/60">
          SECONDS
          <input
            className="h-11 w-full border border-foreground/20 bg-white px-3 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
            defaultValue={remainingSeconds}
            max={59}
            min={0}
            name="durationSeconds"
            placeholder="0"
            required
            type="number"
          />
        </label>
      </fieldset>
      <button
        className="min-h-11 bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending
          ? "Saving..."
          : distanceKm === null
            ? "Save run"
            : "Update run"}
      </button>
      {state.message && (
        <p
          aria-live="polite"
          className="m-0 text-xs text-red-800 sm:col-span-3"
          role="alert"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
