"use client";
// The Discard workout button on the workout page (D47): asks first, then deletes the
// unfinished workout and its sets and returns to the session landing.

import { useFormStatus } from "react-dom";
import { discardWorkout } from "@/app/session/discardAction";

const CONFIRM_MESSAGE =
  "Discard this workout? Its logged sets are deleted and this can't be undone.";

function DiscardSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="min-h-11 text-sm text-[var(--error)] underline underline-offset-4 disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? "Discarding…" : "Discard workout"}
    </button>
  );
}

export default function DiscardWorkoutButton({
  workoutId,
}: {
  workoutId: number;
}) {
  return (
    <form
      action={discardWorkout.bind(null, workoutId)}
      onSubmit={(event) => {
        if (!window.confirm(CONFIRM_MESSAGE)) event.preventDefault();
      }}
    >
      <DiscardSubmit />
    </form>
  );
}
