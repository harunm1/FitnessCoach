"use client";

import { useActionState } from "react";
import {
  deleteProgressPhoto,
  type PhotoActionState,
} from "@/app/progress/photos/actions";

export function DeletePhotoButton({ photoId }: { photoId: number }) {
  const [state, action, pending] = useActionState<PhotoActionState, FormData>(
    deleteProgressPhoto,
    { status: "idle" },
  );

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this photo? This can't be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="photoId" value={photoId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 text-xs text-foreground/60 underline underline-offset-4 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
