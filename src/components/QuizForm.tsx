"use client";

import { useState, type FormEvent } from "react";

const controlClassName =
  "mt-2 min-h-11 w-full border border-foreground/20 bg-white px-3 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10";

const equipmentOptions = [
  "Bodyweight only",
  "Dumbbells",
  "Barbell",
  "Cable machine",
  "Weight machines",
  "Kettlebells",
];

export default function QuizForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form className="space-y-7" onSubmit={handleSubmit}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">What is your main goal?</legend>
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
        <select className={controlClassName} defaultValue="" id="level" name="level" required>
          <option disabled value="">Choose your experience level</option>
          <option value="BEGINNER">New or returning to exercise</option>
          <option value="INTERMEDIATE">I have a regular routine</option>
          <option value="EXPERT">I have trained consistently for years</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-semibold" htmlFor="daysPerWeek">
          How many days per week can you train?
        </label>
        <select className={controlClassName} defaultValue="3" id="daysPerWeek" name="daysPerWeek">
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <option key={days} value={days}>
              {days} {days === 1 ? "day" : "days"}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">What equipment can you use?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {equipmentOptions.map((option, index) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 border border-foreground/15 bg-white px-3 text-sm has-[:checked]:border-foreground has-[:checked]:bg-foreground/[0.04]"
              key={option}
            >
              <input
                className="accent-foreground"
                defaultChecked={index === 0}
                name="equipment"
                type="checkbox"
                value={option}
              />
              {option}
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

      {submitted && (
        <p aria-live="polite" className="border-l-2 border-foreground px-3 py-2 text-sm" role="status">
          Quiz UI is ready. Saving your profile will be added next.
        </p>
      )}

      <button
        className="min-h-12 w-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-80 sm:w-auto"
        type="submit"
      >
        Continue
      </button>
    </form>
  );
}