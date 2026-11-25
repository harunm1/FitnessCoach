"use client";

// The import form (#131). The chosen file stays in state and is added to the form data by
// hand, because a Server Action form submit would clear the file input after the preview.
import { startTransition, useActionState, useState } from "react";
import { importWorkouts, type ImportState } from "@/app/import/actions";
import { MAX_IMPORT_BYTES } from "@/lib/import/hevy";
import type { WeightUnit } from "@/lib/units/convert";
import { ImportPreview, ImportResultPanel } from "./ImportPreview";

export function ImportForm({
  weightUnit = "KG",
}: {
  weightUnit?: WeightUnit; // what the user chose (D30)
}) {
  const [state, dispatch, pending] = useActionState<ImportState, FormData>(
    importWorkouts,
    { status: "idle" },
  );
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState(false);
  // The file the preview on screen was made from: choosing another file hides that preview,
  // so Import never saves a file nobody has previewed.
  const [previewed, setPreviewed] = useState<File | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget);
    data.set(
      "intent",
      submitter instanceof HTMLButtonElement && submitter.value === "save"
        ? "save"
        : "preview",
    );
    if (data.get("intent") === "preview") setPreviewed(file);
    data.delete("file");
    if (file) data.set("file", file);
    startTransition(() => dispatch(data));
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Hevy workout export (.csv, up to 2 MB)
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            setTooBig(chosen !== null && chosen.size > MAX_IMPORT_BYTES);
            setFile(chosen);
          }}
          className="border border-foreground/30 bg-background px-2 py-2 text-sm font-normal"
        />
      </label>
      <button
        type="submit"
        name="intent"
        value="preview"
        disabled={pending || file === null || tooBig}
        className="w-fit border border-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Reading..." : "Preview"}
      </button>

      {tooBig && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          The file is over 2 MB. Export a shorter range from Hevy.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}
      {state.status === "preview" && previewed === file && (
        <fieldset disabled={pending} className="contents">
          <ImportPreview
            summary={state.summary}
            unmatched={state.unmatched}
            moreUnmatched={state.moreUnmatched}
            library={state.library}
            weightUnit={weightUnit}
          />
        </fieldset>
      )}
      {state.status === "saved" && (
        <ImportResultPanel result={state.result} report={state.report} />
      )}
    </form>
  );
}
