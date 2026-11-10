"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { saveQuizProfile } from "@/app/onboarding/actions";
import {
  equipmentOptions,
  quizProfileSchema,
  type QuizActionState,
} from "@/lib/onboarding/schema";

const controlClassName =
  "mt-2 min-h-11 w-full border border-foreground/20 bg-white px-3 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10";

export default function QuizForm() {
  const initialState: QuizActionState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(
    saveQuizProfile,
    initialState,
  );
  const [clientError, setClientError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = quizProfileSchema.safeParse({
      goal: formData.get("goal"),
      level: formData.get("level"),
      daysPerWeek: formData.get("daysPerWeek"),
      equipment: formData.getAll("equipment"),
      injuries: formData.get("injuries") ?? "",
    });

    if (!parsed.success) {
      event.preventDefault();
      setClientError(
        parsed.error.issues[0]?.message ?? "Check your answers and try again.",
      );
      return;
    }

    setClientError("");
  }

  return (
    <form action={formAction} className="space-y-7" onSubmit={handleSubmit}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          What is your main goal?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["STRENGTH", "Get stronger"],
            ["MUSCLE", "Build muscle"],
            ["FAT_LOSS", "Lose body fat"],
            ["GENERAL_FITNESS", "Improve general fitness"],
          ].map(([value, label], index) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 border border-foreground/15 bg-white px-3 text-sm has-[:checked]:border-foreground has-[:checked]:bg-foreground/[0.04]"
              key={value}
            >
              <input
                className="accent-foreground"
                defaultChecked={index === 0}
                name="goal"
                required
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-semibold" htmlFor="level">
          How would you describe your experience?
        </label>
        <select
          className={controlClassName}
          defaultValue=""
          id="level"
          name="level"
          required
        >
          <option disabled value="">
            Choose your experience level
          </option>
          <option value="BEGINNER">New or returning to exercise</option>
          <option value="INTERMEDIATE">I have a regular routine</option>
          <option value="EXPERT">I have trained consistently for years</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="daysPerWeek">
          How many days per week can you train?
        </label>
        <select
          className={controlClassName}
          defaultValue="3"
          id="daysPerWeek"
          name="daysPerWeek"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <option key={days} value={days}>
              {days} {days === 1 ? "day" : "days"}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          What equipment can you use?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {equipmentOptions.map((option, index) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 border border-foreground/15 bg-white px-3 text-sm has-[:checked]:border-foreground has-[:checked]:bg-foreground/[0.04]"
              key={option.value}
            >
              <input
                className="accent-foreground"
                defaultChecked={index === 0}
                name="equipment"
                type="checkbox"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-semibold" htmlFor="injuries">
          Injuries or movements to avoid
          <span className="ml-2 font-normal text-foreground/60">Optional</span>
        </label>
        <textarea
          className={`${controlClassName} min-h-24 resize-y py-3`}
          id="injuries"
          maxLength={500}
          name="injuries"
          placeholder="Share anything you want your plan to account for."
          rows={4}
        />
      </div>

      {(clientError || state.status === "error") && (
        <p
          aria-live="polite"
          className="border-l-2 border-red-700 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {clientError || state.message}
        </p>
      )}

      {state.status === "success" && (
        <div
          aria-live="polite"
          className="space-y-2 border-l-2 border-foreground px-3 py-2"
          role="status"
        >
          <p className="m-0 text-sm">{state.message}</p>
          <Link
            className="inline-block text-sm font-semibold underline underline-offset-4"
            href="/session"
          >
            View your plan
          </Link>
        </div>
      )}

      <button
        className="min-h-12 w-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        disabled={isPending}
        type="submit"
      >
        {isPending
          ? "Saving..."
          : state.status === "success"
            ? "Update profile"
            : "Save profile"}
      </button>
    </form>
  );
}
