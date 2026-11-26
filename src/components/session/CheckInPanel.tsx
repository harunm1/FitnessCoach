"use client";

// "How do you feel today?" (D44): one optional pain or soreness score before the workout,
// skipped by default. It replaces the two pain boxes of every set row. The score is kept
// with each set as "pain this morning before workout", so the stop rule of #92 reads it as
// it always did, and a score in the stop range blocks logging at once.
import {
  PAIN_TRAFFIC_THRESHOLDS,
  painTrafficLight,
} from "@/lib/coach/painTrafficLight";
import { checkInInvalid, parseCheckIn } from "@/lib/workout/setTable";
import { checkInKey, useDeviceValue } from "@/lib/workout/useDeviceValue";

const TRAFFIC_STYLE = {
  stop: "border-red-700 text-red-800",
  hold: "border-amber-700 text-amber-800",
  repeat: "border-green-700 text-green-800",
} as const;

export function useCheckIn(workoutId: number): {
  score: number | null;
  invalid: boolean;
} {
  const [raw] = useDeviceValue(checkInKey(workoutId));
  return { score: parseCheckIn(raw), invalid: checkInInvalid(raw) };
}

export default function CheckInPanel({ workoutId }: { workoutId: number }) {
  const [raw, setRaw] = useDeviceValue(checkInKey(workoutId));
  const score = parseCheckIn(raw);
  const traffic = score === null ? null : painTrafficLight(0, score);
  return (
    <details className="mb-6 border border-foreground/15 px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold">
        How do you feel today? (optional)
      </summary>
      <label className="mt-3 grid max-w-xs gap-1 text-sm">
        Pain or soreness today, 0 to 10
        <input
          className="h-10 w-24 border border-foreground/20 bg-white px-2 text-foreground"
          inputMode="numeric"
          max={PAIN_TRAFFIC_THRESHOLDS.scoreMax}
          min={0}
          onChange={(event) => setRaw(event.target.value)}
          type="number"
          value={raw}
        />
      </label>
      {checkInInvalid(raw) && (
        <p
          className="mt-3 mb-0 border-l-2 border-red-700 px-3 py-2 text-sm text-red-800"
          role="status"
        >
          Enter a whole number from 0 to 10, or clear the box to skip. Logging
          waits until then.
        </p>
      )}
      {traffic && (
        <p
          aria-live="polite"
          className={`mt-3 mb-0 border-l-2 px-3 py-2 text-sm ${TRAFFIC_STYLE[traffic.state]}`}
          role="status"
        >
          <strong className="capitalize">{traffic.state}</strong>:{" "}
          {traffic.reason}
        </p>
      )}
    </details>
  );
}
