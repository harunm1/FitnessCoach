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
import styles from "./account.module.css";

const idle: ProfilePhotoState = { status: "idle" };
const MAX_ZOOM = 3;

// The framing, in pixels of the upright photo. The server does the cropping.
export function framingForm(area: Area, file?: File) {
  const data = new FormData();
  if (file) data.append("photo", file);
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
const CANT_LOAD =
  "Your photo couldn't be loaded. Refresh the page, or choose the photo again.";

// What the editor is showing: a newly chosen photo, or the current one.
type Editing =
  | { kind: "new"; file: File; preview: string }
  | { kind: "existing"; preview: string };

export function ProfilePhotoForm({
  hasPhoto,
  editUrl,
}: {
  hasPhoto: boolean;
  // The full original of the current photo, when it can be edited.
  editUrl: string | null;
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
  const busy = uploading || editing || removing || checking;
  const error =
    localError ??
    [uploadState, editState, removeState].find(
      (state) => state.status === "error",
    )?.message;

  // Free a chosen photo's memory when it is replaced or the page closes.
  useEffect(() => {
    return () => {
      if (current?.kind === "new") URL.revokeObjectURL(current.preview);
    };
  }, [current]);

  // Opens the editor only once the photo has loaded, so it is never blank.
  async function open(next: Editing) {
    setLocalError(null);
    setChecking(true);
    const loads = await canShowImage(next.preview);
    setChecking(false);
    if (!loads) {
      if (next.kind === "new") URL.revokeObjectURL(next.preview);
      if (input.current) input.current.value = "";
      setLocalError(next.kind === "new" ? NOT_AN_IMAGE : CANT_LOAD);
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
        ? framingForm(area, current.file)
        : framingForm(area);
    const send = current.kind === "new" ? upload : edit;
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
            if (file) {
              void open({
                kind: "new",
                file,
                preview: URL.createObjectURL(file),
              });
            }
          }}
        />
      </label>

      {editUrl && (
        <button
          type="button"
          disabled={busy}
          className={styles.secondaryButton}
          onClick={() => void open({ kind: "existing", preview: editUrl })}
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
            }
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

      {error && (
        <p role="alert" className={styles.trialFormError}>
          {error}
        </p>
      )}

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
