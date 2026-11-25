"use client";

import { useState, useTransition } from "react";
import { setWeightUnit } from "@/app/account/unit-actions";
import type { WeightUnit } from "@/lib/units/convert";

const CHOICES: { unit: WeightUnit; text: string }[] = [
  { unit: "KG", text: "kg" },
  { unit: "LB", text: "lb" },
];

// A small kg/lb switch next to the weight box (D30), so the user can flip without leaving the
// workout. It saves the account setting; the page then shows the new unit and the weight box
// starts empty, so a number typed in the old unit is never read in the new one.
export default function WeightUnitSwitch({ current }: { current: WeightUnit }) {
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <>
      <div
        role="group"
        aria-label="Weight unit"
        className="flex h-10 items-center self-end border border-foreground/20 text-xs font-semibold"
      >
        {CHOICES.map((choice) => (
          <button
            key={choice.unit}
            type="button"
            aria-pressed={choice.unit === current}
            disabled={pending || choice.unit === current}
            className={`h-full px-2 ${choice.unit === current ? "bg-foreground text-background" : "text-foreground/70 hover:bg-foreground/10"}`}
            onClick={() =>
              startTransition(async () => {
                const result = await setWeightUnit(choice.unit);
                setProblem(result.status === "error" ? result.message : null);
              })
            }
          >
            {choice.text}
          </button>
        ))}
      </div>
      {problem && (
        <p role="alert" className="basis-full text-xs text-red-800">
          {problem}
        </p>
      )}
    </>
  );
}
