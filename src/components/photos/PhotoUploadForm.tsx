"use client";

import { useActionState } from "react";
import {
  uploadProgressPhoto,
  type PhotoActionState,
} from "@/app/progress/photos/actions";
import { MAX_PICKED_BYTES, MAX_UPLOAD_BYTES } from "@/lib/photos/limits";
import { shrinkPhoto } from "@/lib/photos/shrink";

const TOO_LARGE = "That photo is too large to upload. Try a smaller one.";

// Shrinks the photo in the browser, then uploads it. Without this, phone
// photos over 4.5 MB would be rejected by Vercel before reaching the server.
export async function shrinkThenUpload(
  previous: PhotoActionState,
  formData: FormData,
  upload: typeof uploadProgressPhoto = uploadProgressPhoto,
  shrink: (file: File) => Promise<File> = shrinkPhoto,
): Promise<PhotoActionState> {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PICKED_BYTES) {
      return { status: "error", message: "Photos can be up to 50 MB." };
    }
    const smaller = await shrink(photo);
    // Still too big (the browser couldn't read it): stop here, since the
    // server would refuse a request this large without a clear message.
    if (smaller.size > MAX_UPLOAD_BYTES) {
      return { status: "error", message: TOO_LARGE };
    }
    formData.set("photo", smaller);
  }
  return upload(previous, formData);
}

export function PhotoUploadForm() {
  const [state, action, pending] = useActionState<PhotoActionState, FormData>(
    (previous, formData) => shrinkThenUpload(previous, formData),
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
          JPEG, PNG or WebP, up to 50 MB. Photos are saved at up to 1600 px, so
          large ones may look a little less sharp than the original. Location
          data is removed.
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
        <p role="alert" className="text-sm text-[var(--error)]">
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
