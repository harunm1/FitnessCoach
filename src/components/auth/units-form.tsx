"use client";

import { useActionState } from "react";
import { saveUnitPrefs, type UnitPrefsState } from "@/app/account/unit-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { UnitPrefs } from "@/lib/units/convert";

const WEIGHT_CHOICES = [
  { value: "LB", text: "Pounds (lb)" },
  { value: "KG", text: "Kilograms (kg)" },
];
const DISTANCE_CHOICES = [
  { value: "MI", text: "Miles (mi)" },
  { value: "KM", text: "Kilometres (km)" },
];

function Choice({
  name,
  value,
  text,
  current,
}: {
  name: string;
  value: string;
  text: string;
  current: string;
}) {
  return (
    <Label className="cursor-pointer gap-2">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={value === current}
        className="size-4 accent-current"
      />
      {text}
    </Label>
  );
}

// The units setting on the account page (D29): one choice for weights, one for distances.
// What is stored stays kg and km; only what is typed and shown changes.
export function UnitsForm({ weightUnit, distanceUnit }: UnitPrefs) {
  const initial: UnitPrefsState = { status: "idle" };
  const [state, formAction, isPending] = useActionState(saveUnitPrefs, initial);

  return (
    <form action={formAction} className="mt-4 grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Weight</legend>
        {WEIGHT_CHOICES.map((choice) => (
          <Choice
            key={choice.value}
            name="weightUnit"
            current={weightUnit}
            {...choice}
          />
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Distance</legend>
        {DISTANCE_CHOICES.map((choice) => (
          <Choice
            key={choice.value}
            name="distanceUnit"
            current={distanceUnit}
            {...choice}
          />
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save units"}
        </Button>
        {state.status === "saved" && (
          <p role="status" className="text-sm">
            Units saved.
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-800">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
