// The message box for the coach (#63): sends through the Server Action and shows its pending and error states.
"use client";

import { useActionState, useId } from "react";
import { sendCoachMessage, type CoachActionState } from "./actions";

const initialState: CoachActionState = { status: "idle" };

export default function CoachForm() {
  const [state, formAction, pending] = useActionState(
    sendCoachMessage,
    initialState,
  );
  const inputId = useId();

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <label className="text-sm font-semibold" htmlFor={inputId}>
        Message the coach
      </label>
      <textarea
        className="min-h-24 rounded-md border border-foreground/25 bg-background px-3 py-2 text-base"
        disabled={pending}
        id={inputId}
        name="message"
        placeholder="For example: can I swap squats for lunges today?"
        required
        rows={3}
      />
      {pending ? (
        <p className="m-0 text-sm text-foreground/70" role="status">
          The coach is replying...
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="m-0 text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="min-h-12 bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        Send
      </button>
    </form>
  );
}
