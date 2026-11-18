// The message box for the coach (#63): sends through the Server Action and shows its pending, error and unsaved-retry states.
"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import QuickReplies from "@/components/coach/QuickReplies";
import { sendCoachMessage, type CoachActionState } from "./actions";
import { MESSAGE_MAX_LENGTH } from "./copy";
import UnsavedNotice from "./UnsavedNotice";

const initialState: CoachActionState = { status: "idle" };

export default function CoachForm() {
  const [state, formAction, pending] = useActionState(
    sendCoachMessage,
    initialState,
  );
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The send button is disabled while the coach replies, which drops keyboard focus;
  // it goes back to the message box after a saved exchange or an error. After an
  // unsaved reply it goes to Send again instead (autoFocus in UnsavedNotice).
  useEffect(() => {
    if (state.status === "sent" || state.status === "error") {
      inputRef.current?.focus();
    }
  }, [state]);

  return (
    <>
      {state.status === "unsaved" && !pending ? (
        <UnsavedNotice
          action={formAction}
          message={state.message}
          reply={state.reply}
          text={state.text}
        />
      ) : null}
      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <label className="text-sm font-semibold" htmlFor={inputId}>
          Message the coach
        </label>
        <textarea
          aria-describedby={state.status === "error" ? errorId : undefined}
          className="min-h-24 rounded-md border border-foreground/25 bg-background px-3 py-2 text-base"
          id={inputId}
          maxLength={MESSAGE_MAX_LENGTH}
          name="message"
          placeholder="For example: can I swap squats for lunges today?"
          // Read-only, not disabled, while pending: a disabled box loses focus.
          readOnly={pending}
          ref={inputRef}
          required
          rows={3}
        />
        <QuickReplies disabled={pending} />
        {pending ? (
          <p className="m-0 text-sm text-foreground/70" role="status">
            The coach is replying...
          </p>
        ) : null}
        {state.status === "error" ? (
          <p className="m-0 text-sm" id={errorId} role="alert">
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
    </>
  );
}
