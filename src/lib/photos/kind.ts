// Which kind of photo a form sent, and which exercise a form photo is for (D37).
// Shared by the upload action and the upload form, so both use one set of
// names and one rule.

export const PHOTO_KINDS = ["PROGRESS", "FORM"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

// Which camera a phone or a webcam should use: the back one for a progress
// photo (someone else, or a mirror, holds it), the front for a form selfie.
export type Facing = "user" | "environment";

const FACING: Record<PhotoKind, Facing> = {
  PROGRESS: "environment",
  FORM: "user",
};

export function facingFor(kind: PhotoKind): Facing {
  return FACING[kind];
}

// The longest exercise id is a slug of a few dozen characters; this only
// keeps an absurd value from reaching the database.
const MAX_EXERCISE_ID_LENGTH = 200;

export const KIND_MESSAGE = "Choose progress photo or form photo.";
export const EXERCISE_MESSAGE = "That exercise couldn't be found.";

export type KindResult =
  | { ok: true; kind: PhotoKind; exerciseId: string | undefined }
  | { ok: false; message: string };

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isPhotoKind(value: string): value is PhotoKind {
  return (PHOTO_KINDS as readonly string[]).includes(value);
}

// A missing or blank kind is a progress photo, so forms that predate D37 keep
// working. An exercise only counts on a form photo; with a progress photo it
// is dropped rather than refused, since the form hides the field there.
export function readPhotoKind(formData: FormData): KindResult {
  const sent = text(formData.get("kind"));
  const kind = sent === "" ? "PROGRESS" : sent;
  if (!isPhotoKind(kind)) return { ok: false, message: KIND_MESSAGE };

  const exerciseId = text(formData.get("exerciseId"));
  if (kind !== "FORM" || exerciseId === "") {
    return { ok: true, kind, exerciseId: undefined };
  }
  if (exerciseId.length > MAX_EXERCISE_ID_LENGTH) {
    return { ok: false, message: EXERCISE_MESSAGE };
  }
  return { ok: true, kind, exerciseId };
}

// The line a form photo gets under it in the gallery, "Form photo · Barbell
// Squat". A progress photo needs none, so its caption stays as it was.
export function kindLabel(
  kind: PhotoKind,
  exerciseName: string | null,
): string | null {
  if (kind !== "FORM") return null;
  return exerciseName ? `Form photo · ${exerciseName}` : "Form photo";
}
