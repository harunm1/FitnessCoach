"use client";

import { useActionState } from "react";
import {
  logBodyWeight,
  type WeightActionState,
} from "@/app/progress/weight/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EARLIEST_DAY, MAX_NOTE_LENGTH } from "@/lib/progress/weight";
import { dayLabel } from "@/lib/progress/weightChart";

// Logs one weigh-in (D24). The browser limits are only hints; the Server
// Action checks every field again.
export default function WeightForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<WeightActionState, FormData>(
    logBodyWeight,
    { status: "idle" },
  );
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
          defaultValue={today}
          min={EARLIEST_DAY}
          max={today}
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="weight-kg">Weight (kg)</Label>
        {/* Text, not number: some keyboards type "81,5", which the server accepts. */}
        <Input
          id="weight-kg"
          name="weightKg"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="81.5"
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
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save weight"}
      </Button>
      <p
        role={state.status === "error" ? "alert" : "status"}
        className="m-0 text-sm sm:col-span-4"
      >
        {state.status === "error" && state.message}
        {state.status === "saved" &&
          `Saved your weight for ${dayLabel(state.date)}.`}
      </p>
    </form>
  );
}
