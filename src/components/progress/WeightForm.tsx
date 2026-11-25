"use client";

import { useActionState } from "react";
import {
  logBodyWeight,
  type WeightActionState,
} from "@/app/progress/weight/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayLabel } from "@/lib/progress/weightChart";
import { EARLIEST_DAY, MAX_NOTE_LENGTH } from "@/lib/progress/weightLimits";
import { weightLabel, type WeightUnit } from "@/lib/units/convert";

// Logs one weigh-in (D24). The browser limits are only hints; the Server
// Action checks every field again.
export default function WeightForm({
  today,
  weightUnit = "KG",
}: {
  today: string;
  weightUnit?: WeightUnit; // what the user chose (D29); the form posts it back
}) {
  const [state, action, pending] = useActionState<WeightActionState, FormData>(
    logBodyWeight,
    { status: "idle" },
  );
  // React resets the form after each action, to these defaults: after an
  // error they are what the user typed, so nothing has to be typed again.
  const typed = state.status === "error" ? state.values : undefined;
  return (
    <form
      action={action}
      className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
    >
      <div className="grid gap-1">
        <Label htmlFor="weight-date">Day</Label>
        <Input
          id="weight-date"
          name="date"
          type="date"
          defaultValue={typed?.date ?? today}
          min={EARLIEST_DAY}
          max={today}
          required
        />
      </div>
      <div className="grid gap-1">
        <input name="weightUnit" type="hidden" value={weightUnit} />
        <Label htmlFor="weight-kg">Weight ({weightLabel(weightUnit)})</Label>
        {/* Text, not number: some keyboards type "81,5", which the server accepts. */}
        <Input
          id="weight-kg"
          name="weightKg"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={weightUnit === "LB" ? "180" : "81.5"}
          defaultValue={typed?.weightKg ?? ""}
          className="w-28"
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="weight-note">Note (optional)</Label>
        <Input
          id="weight-note"
          name="note"
          type="text"
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Morning, before breakfast"
          defaultValue={typed?.note ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save weight"}
      </Button>
      {/* Two regions, both in the page from the start, so each is announced
          when filled; a region whose role changes may not be read out. */}
      <p role="status" className="m-0 text-sm sm:col-span-4">
        {state.status === "saved" &&
          `Saved your weight for ${dayLabel(state.date)}.`}
      </p>
      <p role="alert" className="m-0 text-sm sm:col-span-4">
        {state.status === "error" && state.message}
      </p>
    </form>
  );
}
