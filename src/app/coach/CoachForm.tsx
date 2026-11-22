// The coach form streams checked sentences and keeps failed exchanges available for retry.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuickReplies from "@/components/coach/QuickReplies";
import type { CoachActionState } from "./actions";
import {
  LOAD_FAILED_MESSAGE,
  MESSAGE_MAX_LENGTH,
  SAVE_FAILED_MESSAGE,
} from "./copy";
import { readCoachStream } from "./stream-client";
import UnsavedNotice from "./UnsavedNotice";

const initialState: CoachActionState = { status: "idle" };

export default function CoachForm() {
  const router = useRouter();
  const sending = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [state, setState] = useState<CoachActionState>(initialState);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function send(data: FormData): Promise<CoachActionState> {
    // Quick replies and Send again use the same authenticated endpoint.
    const text =
      [data.get("quickReply"), data.get("message")]
        .find((value) => typeof value === "string" && value.trim() !== "")
        ?.toString()
        .trim() ?? "";
    const controller = new AbortController();
    activeRequest.current = controller;
    setDraft(text);
    setReply("");
    let received = "";
    let result: CoachActionState | undefined;
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error: unknown = await response.json();
        const message =
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : LOAD_FAILED_MESSAGE;
        return response.status >= 500
          ? { status: "unsaved", text, message }
          : { status: "error", message };
      }
      await readCoachStream(response, (event) => {
        if (event.type === "delta") {
          received += event.text;
          setReply(received);
        } else if (event.type === "saved") {
          result = { status: "sent" };
        } else {
          result = {
            status: "unsaved",
            text,
            reply: received,
            message: event.message,
          };
        }
      });
      if (result?.status === "sent") router.refresh();
      return (
        result ?? {
          status: "unsaved",
          text,
          reply: received,
          message: SAVE_FAILED_MESSAGE,
        }
      );
    } catch {
      return {
        status: "unsaved",
        text,
        reply: received,
        message: SAVE_FAILED_MESSAGE,
      };
    } finally {
      activeRequest.current = null;
    }
  }

  function formAction(data: FormData) {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    void send(data)
      .then((result) => {
        setState(result);
        if (result.status === "sent") setMessage("");
      })
      .finally(() => {
        sending.current = false;
        setPending(false);
      });
  }
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
      {pending && draft ? (
        <div
          className="mt-4 flex flex-col gap-3"
          aria-label="Current coach exchange"
        >
          <p className="m-0 ml-8 rounded-lg bg-foreground/10 px-4 py-3 text-sm whitespace-pre-line">
            {draft}
          </p>
          {reply ? (
            <p
              className="m-0 mr-8 rounded-lg border border-foreground/15 px-4 py-3 text-sm whitespace-pre-line"
              role="log"
              aria-live="polite"
              aria-label="Coach reply"
            >
              {reply}
            </p>
          ) : null}
        </div>
      ) : null}
      {state.status === "unsaved" && !pending ? (
        <UnsavedNotice
          action={formAction}
          message={state.message}
          reply={state.reply}
          text={state.text}
        />
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(event.currentTarget);
          if (submitter instanceof HTMLButtonElement && submitter.name) {
            data.set(submitter.name, submitter.value);
          }
          formAction(data);
        }}
        className="mt-6 flex flex-col gap-3"
      >
        <label className="text-sm font-semibold" htmlFor={inputId}>
          Message the coach
        </label>
        <textarea
          aria-describedby={state.status === "error" ? errorId : undefined}
          className="min-h-24 rounded-md border border-foreground/25 bg-background px-3 py-2 text-base"
          id={inputId}
          maxLength={MESSAGE_MAX_LENGTH}
          name="message"
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
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
        {state.status === "error" && !pending ? (
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
