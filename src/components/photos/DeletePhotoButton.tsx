"use client";

import { useActionState } from "react";
import {
  deleteProgressPhoto,
  type PhotoActionState,
} from "@/app/progress/photos/actions";

type DeletePhotoButtonProps = {
  photoId: number;
  takenOn: string; // e.g. "Nov 12, 2026", so each button says which photo
};

export function DeletePhotoButton({
  photoId,
  takenOn,
}: DeletePhotoButtonProps) {
  const [state, action, pending] = useActionState<PhotoActionState, FormData>(
    deleteProgressPhoto,
    { status: "idle" },
  );

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete the photo from ${takenOn}? This can't be undone.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="photoId" value={photoId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${pending ? "Deleting" : "Delete"} photo from ${takenOn}`}
        className="min-h-11 text-xs text-foreground/60 underline underline-offset-4 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {state.message}
        </p>
      )}
    </form>
  );
}
