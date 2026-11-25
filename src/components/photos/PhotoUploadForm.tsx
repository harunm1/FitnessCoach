"use client";

import { useActionState, useRef, useState } from "react";
import {
  uploadProgressPhoto,
  type PhotoActionState,
} from "@/app/progress/photos/actions";
import { facingFor, type PhotoKind } from "@/lib/photos/kind";
import { MAX_PICKED_BYTES, MAX_UPLOAD_BYTES } from "@/lib/photos/limits";
import { CameraCapture } from "./CameraCapture";
import { shrinkPhoto } from "@/lib/photos/shrink";
import {
  weightBounds,
  weightLabel,
  type WeightUnit,
} from "@/lib/units/convert";

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

export type ExerciseChoice = { id: string; name: string };

const KIND_OPTIONS: { value: PhotoKind; label: string }[] = [
  { value: "PROGRESS", label: "Progress photo" },
  { value: "FORM", label: "Form photo" },
];

export function PhotoUploadForm({
  weightUnit = "KG",
  exercises = [],
}: {
  weightUnit?: WeightUnit; // what the user chose (D30); the form posts it back
  exercises?: ExerciseChoice[]; // what a form photo can be linked to (D39)
}) {
  const [minWeight, maxWeight] = weightBounds(20, 400, weightUnit);
  const [kind, setKind] = useState<PhotoKind>("PROGRESS");
  // A photo taken in the app. It is sent in place of the file input's photo.
  const [taken, setTaken] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // A camera photo replaces any file picked before, so the input is emptied
  // and its old name doesn't stay on screen.
  function takePhoto(file: File) {
    if (fileRef.current) fileRef.current.value = "";
    setTaken(file);
  }
  const [state, action, pending] = useActionState<PhotoActionState, FormData>(
    async (previous, formData) => {
      if (taken) formData.set("photo", taken);
      const result = await shrinkThenUpload(previous, formData);
      if (result.status === "saved") setTaken(null);
      return result;
    },
    { status: "idle" },
  );

  return (
    <form
      action={action}
      className="grid gap-4 border border-foreground/15 p-5"
    >
      <fieldset className="grid gap-2 text-sm">
        <legend className="font-medium">Type of photo</legend>
        <div className="flex flex-wrap gap-x-6">
          {KIND_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 items-center gap-2"
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "FORM" && exercises.length > 0 && (
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Exercise (optional)</span>
          <select
            name="exerciseId"
            defaultValue=""
            className="min-h-11 border border-foreground/30 bg-transparent px-3"
          >
            <option value="">No specific exercise</option>
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-2 text-sm">
        <CameraCapture facing={facingFor(kind)} onPhoto={takePhoto} />
        {taken && (
          <p role="status" className="flex flex-wrap items-center gap-3">
            <span>Photo ready: {taken.name}</span>
            <button
              type="button"
              onClick={() => setTaken(null)}
              className="min-h-11 underline"
            >
              Remove photo
            </button>
          </p>
        )}
      </div>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">
          {taken ? "Or choose a different photo" : "Photo"}
        </span>
        {/* Limiting the types makes iPhones convert HEIC photos to JPEG. */}
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          ref={fileRef}
          required={!taken}
          onChange={() => setTaken(null)}
          className="text-sm file:mr-3 file:min-h-11 file:border file:border-foreground/30 file:bg-transparent file:px-4 file:text-sm"
        />
        <span className="text-xs text-foreground/60">
          JPEG, PNG or WebP, up to 50 MB. Photos are saved at up to 1600 px, so
          large ones may look a little less sharp than the original. Location
          data is removed.
        </span>
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">
          Weight ({weightLabel(weightUnit)}, optional)
        </span>
        <input name="weightUnit" type="hidden" value={weightUnit} />
        <input
          type="number"
          name="weightKg"
          inputMode="decimal"
          min={minWeight}
          max={maxWeight}
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
