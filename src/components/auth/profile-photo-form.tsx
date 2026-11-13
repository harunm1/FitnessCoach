"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  editProfilePhoto,
  removeProfilePhoto,
  uploadProfilePhoto,
  type ProfilePhotoState,
} from "@/app/account/profile-photo-actions";
import { MAX_PICKED_BYTES, MAX_UPLOAD_BYTES } from "@/lib/photos/limits";
import { shrinkPhoto } from "@/lib/photos/shrink";
import styles from "./account.module.css";

const idle: ProfilePhotoState = { status: "idle" };
const MAX_ZOOM = 3;

// The framing, in pixels of the upright photo. The server does the cropping.
// A new photo is sent with it; an edit names the photo it was framed on.
export function framingForm(
  area: Area,
  photo: { file: File } | { key: string },
) {
  const data = new FormData();
  if ("file" in photo) data.append("photo", photo.file);
  else data.append("photoKey", photo.key);
  data.append("cropLeft", String(area.x));
  data.append("cropTop", String(area.y));
  data.append("cropWidth", String(area.width));
  data.append("cropHeight", String(area.height));
  return data;
}

// Resolves true once the browser can draw the image, false if it can't
// (for example a text file renamed to .jpg, or a link that has expired).
export function canShowImage(
  src: string,
  createImage: () => HTMLImageElement = () => new Image(),
): Promise<boolean> {
  return new Promise((resolve) => {
    const image = createImage();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

const NOT_AN_IMAGE = "That file isn't an image we can read.";
const TOO_BIG_TO_PICK = "Photos can be up to 50 MB.";
const TOO_LARGE = "That photo is too large to upload. Try a smaller one.";
const UNEXPECTED = "Something went wrong. Try again.";
const CANT_LOAD =
  "Your photo couldn't be loaded. Refresh the page, or choose the photo again.";

// Which action ran last, so only its result is shown. Without this an old
// error could stay on screen after a later save worked.
type LastAction = "upload" | "edit" | "remove";

// The message for the most recent action: an error, or a short confirmation
// that screen readers announce.
export function latestResult(
  last: LastAction | null,
  states: Record<LastAction, ProfilePhotoState>,
): { kind: "error" | "status"; text: string } | null {
  if (!last) return null;
  const state = states[last];
  if (state.status === "error") {
    return { kind: "error", text: state.message ?? UNEXPECTED };
  }
  if (state.status === "saved") return { kind: "status", text: "Photo saved." };
  if (state.status === "removed") {
    return { kind: "status", text: "Photo removed." };
  }
  return null;
}

// What the editor is showing: a newly chosen photo, or the current one.
type Editing =
  | { kind: "new"; file: File; preview: string }
  | { kind: "existing"; preview: string; key: string };

export function ProfilePhotoForm({
  hasPhoto,
  editUrl,
  editKey,
}: {
  hasPhoto: boolean;
  // The full original of the current photo, when it can be edited.
  editUrl: string | null;
  // Which photo that is, so an edit can't land on a newer one.
  editKey: string | null;
}) {
  const id = useId();
  const [uploadState, upload, uploading] = useActionState<
    ProfilePhotoState,
    FormData
  >(uploadProfilePhoto, idle);
  const [editState, edit, editing] = useActionState<
    ProfilePhotoState,
    FormData
  >(editProfilePhoto, idle);
  const [removeState, remove, removing] = useActionState<
    ProfilePhotoState,
    FormData
  >(removeProfilePhoto, idle);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<Editing | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [checking, setChecking] = useState(false);
  // A problem found in the browser, before anything is sent to the server.
  const [localError, setLocalError] = useState<string | null>(null);
  const [last, setLast] = useState<LastAction | null>(null);
  const busy = uploading || editing || removing || checking;
  const pending =
    (last === "upload" && uploading) ||
    (last === "edit" && editing) ||
    (last === "remove" && removing);
  const result: { kind: "error" | "status"; text: string } | null = localError
    ? { kind: "error", text: localError }
    : pending
      ? null
      : latestResult(last, {
          upload: uploadState,
          edit: editState,
          remove: removeState,
        });

  // Free a chosen photo's memory when it is replaced or the page closes.
  useEffect(() => {
    return () => {
      if (current?.kind === "new") URL.revokeObjectURL(current.preview);
    };
  }, [current]);

  // Stops before the editor opens, with a message for the user.
  function refuse(message: string) {
    if (input.current) input.current.value = "";
    setChecking(false);
    setLocalError(message);
  }

  // A newly chosen photo is made smaller in the browser first, so it fits
  // the 4 MB upload limit. The editor then frames the smaller copy, and the
  // framing is measured on the same photo the server receives.
  async function choose(file: File) {
    setLocalError(null);
    setLast(null);
    if (file.size > MAX_PICKED_BYTES) {
      refuse(TOO_BIG_TO_PICK);
      return;
    }
    setChecking(true);
    const smaller = await shrinkPhoto(file);
    await open({
      kind: "new",
      file: smaller,
      preview: URL.createObjectURL(smaller),
    });
  }

  // Opens the editor only once the photo has loaded, so it is never blank.
  async function open(next: Editing) {
    setLocalError(null);
    setLast(null);
    setChecking(true);
    const loads = await canShowImage(next.preview);
    setChecking(false);
    if (!loads) {
      if (next.kind === "new") URL.revokeObjectURL(next.preview);
      refuse(next.kind === "new" ? NOT_AN_IMAGE : CANT_LOAD);
      return;
    }
    // Still too big: the browser couldn't shrink it, and the server would
    // refuse a request this large without a clear message.
    if (next.kind === "new" && next.file.size > MAX_UPLOAD_BYTES) {
      URL.revokeObjectURL(next.preview);
      refuse(TOO_LARGE);
      return;
    }
    setCurrent(next);
    setPosition({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
    setCurrent(null);
    // Lets the same file be chosen again after cancelling.
    if (input.current) input.current.value = "";
  }

  function save() {
    if (!current || !area) return;
    const data =
      current.kind === "new"
        ? framingForm(area, { file: current.file })
        : framingForm(area, { key: current.key });
    const send = current.kind === "new" ? upload : edit;
    setLast(current.kind === "new" ? "upload" : "edit");
    close();
    startTransition(() => send(data));
  }

  return (
    <div className={styles.profilePhotoActions}>
      {/* Limiting the types makes iPhones convert HEIC photos to JPEG. */}
      <label
        className={styles.secondaryButton}
        aria-disabled={busy || undefined}
      >
        {uploading
          ? "Uploading…"
          : checking
            ? "Opening…"
            : hasPhoto
              ? "Change photo"
              : "Add photo"}
        <input
          ref={input}
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className={styles.visuallyHidden}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void choose(file);
          }}
        />
      </label>

      {editUrl && editKey && (
        <button
          type="button"
          disabled={busy}
          className={styles.secondaryButton}
          onClick={() =>
            void open({ kind: "existing", preview: editUrl, key: editKey })
          }
        >
          {editing ? "Saving…" : "Edit photo"}
        </button>
      )}

      {hasPhoto && (
        <form
          action={remove}
          onSubmit={(event) => {
            if (!window.confirm("Remove your profile photo?")) {
              event.preventDefault();
              return;
            }
            setLocalError(null);
            setLast("remove");
          }}
        >
          <button
            type="submit"
            disabled={busy}
            className={styles.secondaryButton}
          >
            {removing ? "Removing…" : "Remove photo"}
          </button>
        </form>
      )}

      <p className={styles.fieldHint}>
        JPEG, PNG or WebP, up to 50 MB. Large photos are made smaller first.
      </p>

      {result?.kind === "error" && (
        <p role="alert" className={styles.trialFormError}>
          {result.text}
        </p>
      )}
      {/* Always present, so screen readers announce the confirmation. */}
      <p role="status" className={styles.trialFormStatus}>
        {result?.kind === "status" ? result.text : ""}
      </p>

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className={styles.passwordDialog}
        onCancel={close}
      >
        <div className={styles.dialogHeader}>
          <h2 id={`${id}-title`} className={styles.dialogTitle}>
            Edit your photo
          </h2>
        </div>
        <p className={styles.dialogDescription}>
          Drag to move the photo, and zoom to fit the circle.
        </p>
        <div className={styles.photoEditor}>
          {current && (
            <Cropper
              image={current.preview}
              crop={position}
              zoom={zoom}
              maxZoom={MAX_ZOOM}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setPosition}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>
        <label className={styles.photoZoom}>
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
          />
        </label>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!area}
            onClick={save}
          >
            Save photo
          </button>
        </div>
      </dialog>
    </div>
  );
}
