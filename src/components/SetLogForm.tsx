"use client";

import { useRef, useState, type FormEvent } from "react";
import { setLogSchema } from "@/lib/workout/setLogSchema";
import { weightPlaceholder } from "@/lib/workout/weightPlaceholder";

// What the form hands to the offline set queue (D31). The server checks all of it again.
export type LoggedSetInput = {
  clientId: string;
  setNumber: number;
  reps: number;
  weightKg: string | null;
};

type SetLogFormProps = {
  exerciseId: string;
  targetReps: number;
  nextSetNumber: number;
  equipment?: string | null; // the exercise's equipment, for the weight field's hint
  onLog: (set: LoggedSetInput) => Promise<void> | void; // stores the set on the device
};

export default function SetLogForm({
  exerciseId,
  targetReps,
  nextSetNumber,
  equipment = null,
  onLog,
}: SetLogFormProps) {
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // One clientId per set attempt, kept until the set is stored, so a retry of the same
  // attempt cannot become a second set.
  const attempt = useRef<{ setNumber: number; clientId: string } | null>(null);

  function clientIdFor(setNumber: number): string {
    if (attempt.current?.setNumber !== setNumber) {
      attempt.current = { setNumber, clientId: crypto.randomUUID() };
    }
    return attempt.current.clientId;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const fields = new FormData(event.currentTarget);
    const parsed = setLogSchema.safeParse({
      setNumber: nextSetNumber,
      reps: fields.get("reps"),
      weightKg: fields.get("weightKg"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter valid set details.");
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      const typedWeight = String(fields.get("weightKg") ?? "").trim();
      await onLog({
        clientId: clientIdFor(nextSetNumber),
        setNumber: nextSetNumber,
        reps: parsed.data.reps,
        weightKg: typedWeight === "" ? null : typedWeight,
      });
      attempt.current = null;
    } catch {
      setError("Could not keep this set on the device. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2"
      data-exercise-id={exerciseId}
      onSubmit={handleSubmit}
    >
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
      <button
        className="h-10 bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving..." : `Log set ${nextSetNumber}`}
      </button>
      {error && (
        <p className="basis-full text-xs text-red-800" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
