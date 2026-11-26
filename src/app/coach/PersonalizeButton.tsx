"use client";

// "Personalize with the coach" (#58). Mounted on the Coach page (D40); the
// action decides everything, this only shows the outcome.
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { PersonalizeState } from "@/lib/coach/personalize";
import { personalizeWithCoach } from "./personalize-action";

const initialState: PersonalizeState = { status: "idle" };

export default function PersonalizeButton() {
  const [state, formAction, isPending] = useActionState(
    personalizeWithCoach,
    initialState,
  );
  return (
    <form action={formAction} className="grid gap-2">
      <Button disabled={isPending} type="submit">
        {isPending
          ? "The coach is writing your plan..."
          : "Personalize with the coach"}
      </Button>
      {state.status !== "idle" && (
        <p
          className="m-0 text-sm text-foreground/70"
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
