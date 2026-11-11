"use client";

import { useActionState } from "react";
import { askExerciseCoach } from "@/app/session/bodyMapActions";
import type { ExerciseChatActionState } from "@/lib/coach/exerciseChat";

type ExerciseCoachChatProps = {
  muscle: string;
  exerciseId: string;
};

export default function ExerciseCoachChat({
  muscle,
  exerciseId,
}: ExerciseCoachChatProps) {
  const initialState: ExerciseChatActionState = {
    status: "idle",
    message: "",
  };
  const [state, formAction, isPending] = useActionState(
    askExerciseCoach.bind(null, muscle, exerciseId),
    initialState,
  );

  return (
    <section
      aria-label={`Ask the coach about ${muscle}`}
      className="mt-5 border-t border-foreground/10 pt-4"
    >
      <h4 className="m-0 text-sm font-semibold">Ask the coach</h4>
      <p className="mt-1 mb-0 text-xs leading-5 text-foreground/60">
        Answers use this exercise&apos;s saved instructions and form notes.
      </p>

      {(state.turns?.length ?? 0) > 0 && (
        <ol aria-label="Coach conversation" className="mt-3 space-y-3 p-0">
          {state.turns?.map((turn, index) => (
            <li
              className={`max-w-[95%] list-none px-3 py-2 text-xs leading-5 ${turn.role === "USER" ? "ml-auto border border-foreground/10 bg-[#f5f6f2]" : "border-l-2 border-[#245c43] text-foreground/80"}`}
              key={`${index}-${turn.role}-${turn.content.slice(0, 24)}`}
            >
              {turn.content}
            </li>
          ))}
        </ol>
      )}

      <form
        action={formAction}
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
      >
        <label className="sr-only" htmlFor={`coach-question-${exerciseId}`}>
          Ask a question about {muscle}
        </label>
        <input
          autoComplete="off"
          className="min-h-10 w-full border border-foreground/20 bg-white px-3 text-xs outline-none focus:border-[#245c43] focus:ring-2 focus:ring-[#245c43]/10"
          disabled={isPending}
          id={`coach-question-${exerciseId}`}
          maxLength={500}
          name="question"
          placeholder="Ask about technique, cues, or alternatives…"
          required
        />
        <button
          className="min-h-10 bg-[#245c43] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {state.status === "error" && (
        <p
          aria-live="polite"
          className="mt-2 mb-0 text-xs text-red-800"
          role="alert"
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
