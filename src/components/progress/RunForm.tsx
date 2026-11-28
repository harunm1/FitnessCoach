"use client";

import { useActionState, useRef } from "react";
import { logRun, type RunActionState } from "@/app/progress/run/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayLabel } from "@/lib/progress/weightChart";
import {
  distanceLabel,
  formatDistance,
  type DistanceUnit,
} from "@/lib/units/convert";
import {
  EARLIEST_RUN_DAY,
  MAX_EFFORT,
  MAX_RUN_NOTE_LENGTH,
  MIN_EFFORT,
} from "@/lib/progress/runLimits";

function savedMessage(
  state: Extract<RunActionState, { status: "saved" }>,
  unit: DistanceUnit,
) {
  const pace = state.pace ? ` at ${state.pace}` : "";
  const planDay = state.planDayName
    ? ` It counts as your plan's ${state.planDayName}.`
    : "";
  return `Saved your ${formatDistance(state.distanceKm, unit)} run for ${dayLabel(state.date)}${pace}.${planDay}`;
}

// Logs one run by hand (D27). The browser limits are only hints; the Server
// Action checks every field again.
export default function RunForm({
  today,
  distanceUnit = "KM",
}: {
  today: string;
  distanceUnit?: DistanceUnit; // what the user chose (D30); the form posts it back
}) {
  const [state, action, pending] = useActionState<RunActionState, FormData>(
    logRun,
    { status: "idle" },
  );
  const previousDuration = useRef("");
  // React resets the form after each action, to these defaults: after an
  // error they are what the user typed, so nothing has to be typed again.
  const typed = state.status === "error" ? state.values : undefined;
  return (
    <form
      action={action}
      className="grid gap-3 sm:grid-cols-[auto_auto_auto_auto] sm:items-end"
    >
      <div className="grid gap-1">
        <Label htmlFor="run-date">Day</Label>
        <Input
          id="run-date"
          name="date"
          type="date"
          defaultValue={typed?.date ?? today}
          min={EARLIEST_RUN_DAY}
          max={today}
          required
        />
      </div>
      <div className="grid gap-1">
        <input name="distanceUnit" type="hidden" value={distanceUnit} />
        <Label htmlFor="run-km">Distance ({distanceLabel(distanceUnit)})</Label>
        {/* Text, not number: some keyboards type "5,2", which the server accepts. */}
        <Input
          id="run-km"
          name="distanceKm"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={distanceUnit === "MI" ? "3.2" : "5.2"}
          defaultValue={typed?.distanceKm ?? ""}
          className="w-24"
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="run-time">Time (h:mm:ss)</Label>
        <Input
          id="run-time"
          name="duration"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0:32:15"
          defaultValue={typed?.duration ?? ""}
          className="w-28"
          onFocus={(event) => {
            previousDuration.current = event.currentTarget.value;
          }}
          onChange={(event) => {
            const input = event.currentTarget;
            let value = input.value;
            let cursor = input.selectionStart ?? value.length;
            const inputType = (event.nativeEvent as InputEvent).inputType;
            if (
              inputType === "insertFromPaste" &&
              /^(?:\d{1,2}:)?\d{1,3}:[0-5]\d$/.test(value)
            ) {
              previousDuration.current = value;
              return;
            }
            if (
              inputType === "deleteContentBackward" &&
              previousDuration.current[cursor] === ":" &&
              cursor > 0
            ) {
              value = value.slice(0, cursor - 1) + value.slice(cursor);
              cursor -= 1;
            }
            if (/^\d:([0-5]\d):([0-5]\d)$/.test(value)) {
              previousDuration.current = value;
              return;
            }
            if (!/^[\d:]*$/.test(value)) {
              previousDuration.current = value;
              return;
            }
            const digitsBeforeCursor = value
              .slice(0, cursor)
              .replace(/\D/g, "").length;
            const digits = value.replace(/\D/g, "").slice(0, 6);
            const formatted =
              digits.length === 0
                ? digits
                : digits.length === 6
                  ? `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`
                  : digits.length <= 2
                    ? `${digits.slice(0, 1)}:${digits.slice(1)}`
                    : `${digits.slice(0, 1)}:${digits.slice(1, 3)}:${digits.slice(3)}`;
            input.value = formatted;
            let position = 0;
            let seen = 0;
            while (position < formatted.length && seen < digitsBeforeCursor) {
              if (/\d/.test(formatted[position])) seen += 1;
              position += 1;
            }
            if (
              position === formatted.length - 1 &&
              formatted[position] === ":"
            )
              position += 1;
            input.setSelectionRange(position, position);
            previousDuration.current = formatted;
          }}
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="run-effort">Effort (1 to 10, optional)</Label>
        <Input
          id="run-effort"
          name="effort"
          type="number"
          min={MIN_EFFORT}
          max={MAX_EFFORT}
          step={1}
          defaultValue={typed?.effort ?? ""}
          className="w-24"
        />
      </div>
      <div className="grid gap-1 sm:col-span-3">
        <Label htmlFor="run-note">Note (optional)</Label>
        <Input
          id="run-note"
          name="note"
          type="text"
          maxLength={MAX_RUN_NOTE_LENGTH}
          placeholder="Easy loop by the lake"
          defaultValue={typed?.note ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save run"}
      </Button>
      {/* Two regions, both in the page from the start, so each is announced
          when filled; a region whose role changes may not be read out. */}
      <p role="status" className="m-0 text-sm sm:col-span-4">
        {state.status === "saved" && savedMessage(state, distanceUnit)}
      </p>
      <p role="alert" className="m-0 text-sm sm:col-span-4">
        {state.status === "error" && state.message}
      </p>
    </form>
  );
}
