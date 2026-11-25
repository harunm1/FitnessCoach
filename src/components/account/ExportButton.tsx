"use client";

import { useActionState } from "react";
import {
  createDataExport,
  type ExportActionState,
} from "@/app/account/data/actions";
import { buttonVariants } from "@/components/ui/button";

type ExportButtonProps = {
  kind: "WORKOUT_CSV" | "COACH_CSV" | "MONTHLY_REPORT";
  label: string; // e.g. "Export workout history (CSV)"
};

// One export button: it posts its kind to a Server Action and shows the result in place.
export function ExportButton({ kind, label }: ExportButtonProps) {
  const [state, action, pending] = useActionState<ExportActionState, FormData>(
    createDataExport,
    { status: "idle" },
  );

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="kind" value={kind} />
      <button
        type="submit"
        disabled={pending}
        className={buttonVariants({ variant: "outline" })}
      >
        {pending ? "Making the file…" : label}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {state.message}
        </p>
      )}
      {state.status === "created" && (
        <p role="status" className="text-xs text-foreground/70">
          Done. Your file is in the list below.
        </p>
      )}
    </form>
  );
}
