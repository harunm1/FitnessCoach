"use client";

import { useActionState } from "react";
import {
  uploadProgressPhoto,
  type PhotoActionState,
} from "@/app/progress/photos/actions";

export function PhotoUploadForm() {
  const [state, action, pending] = useActionState<PhotoActionState, FormData>(
    uploadProgressPhoto,
    { status: "idle" },
  );

  return (
    <form
      action={action}
      className="grid gap-4 border border-foreground/15 p-5"
    >
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Photo</span>
        {/* Limiting the types makes iPhones convert HEIC photos to JPEG. */}
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          required
          className="text-sm file:mr-3 file:min-h-11 file:border file:border-foreground/30 file:bg-transparent file:px-4 file:text-sm"
        />
        <span className="text-xs text-foreground/60">
          JPEG, PNG or WebP, up to 10 MB. Location data is removed.
        </span>
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Weight (kg, optional)</span>
        <input
          type="number"
          name="weightKg"
          inputMode="decimal"
          min={20}
          max={400}
          step={0.1}
          className="min-h-11 border border-foreground/30 bg-transparent px-3"
        />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Note (optional)</span>
        <textarea
          name="note"
          maxLength={300}
          rows={2}
          className="border border-foreground/30 bg-transparent px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload photo"}
      </button>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-sm text-foreground/70">
          Photo saved.
        </p>
      )}
    </form>
  );
}
