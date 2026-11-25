"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  browserCameraTools,
  prefersNativeCamera,
  requestCamera as askForCamera,
  resizeCaptured,
  snapshotToFile,
  stopStream,
  type CameraRequest,
} from "@/lib/photos/camera";
import type { Facing } from "@/lib/photos/kind";

type Phase = "idle" | "starting" | "live";

const SNAPSHOT_FAILED =
  "The photo couldn't be taken. Try again, or choose a photo from your files.";

const buttonClass =
  "min-h-11 border border-foreground/30 bg-transparent px-4 text-sm disabled:opacity-50";

// Take a photo with the camera (D39). A phone opens its own camera app through
// a file input with `capture`; a computer shows a live webcam preview and
// takes a snapshot. Either way the photo reaches onPhoto as one small JPEG
// file. The camera is asked for only after the person taps Take photo, and its
// light goes off whenever the preview closes, the form is left, or the
// person gives up while the browser is still asking.
export function CameraCapture({
  facing,
  onPhoto,
  native,
  requestCamera = askForCamera,
  snapshot = (video) => snapshotToFile(video, browserCameraTools),
  resize = (file) => resizeCaptured(file, browserCameraTools),
}: {
  facing: Facing;
  onPhoto: (file: File) => void;
  // True to use the phone's camera app. Left out, it is decided when the
  // button is tapped (a touch screen means a phone).
  native?: boolean;
  requestCamera?: (facing: Facing) => CameraRequest;
  snapshot?: (video: HTMLVideoElement) => Promise<File | null>;
  resize?: (file: File) => Promise<File>;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const capturing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // What is open right now, kept in one place so that every way out
  // (Capture, Cancel, Escape, leaving the page) stops the same things.
  const open = useRef<{
    request: CameraRequest | null;
    stream: MediaStream | null;
  }>({ request: null, stream: null });

  function release() {
    open.current.request?.cancel();
    if (open.current.stream) stopStream(open.current.stream);
    open.current = { request: null, stream: null };
  }

  // Cancel, Escape and Capture give focus back to Take photo; a submit does
  // not, because the person is typing elsewhere.
  const refocus = useRef(true);
  function close(returnFocus = true) {
    refocus.current = returnFocus;
    release();
    setStream(null);
    setPhase("idle");
  }

  // Runs once, on leaving the page.
  useEffect(() => {
    const current = open;
    return () => {
      current.current.request?.cancel();
      if (current.current.stream) stopStream(current.current.stream);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  // The button that opened the preview is enabled again once it closes; focus
  // goes back to it instead of dropping to the page.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (phase === "idle" && wasOpen.current && refocus.current) {
      takeRef.current?.focus();
    }
    wasOpen.current = phase !== "idle";
  }, [phase]);

  // Submitting the form (Enter in the note field, say) ends the preview, so
  // the camera is not left on during and after the upload.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const stopOnSubmit = () => {
      if (open.current.request || open.current.stream) close(false);
    };
    form.addEventListener("submit", stopOnSubmit);
    return () => form.removeEventListener("submit", stopOnSubmit);
    // close only uses refs and state setters, which do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setMessage(null);
    if (native ?? prefersNativeCamera()) {
      inputRef.current?.click();
      return;
    }
    const request = requestCamera(facing);
    open.current.request = request;
    setPhase("starting");
    const outcome = await request.result;
    // Closed while the browser was asking: nothing more to do.
    if (open.current.request !== request) return;
    open.current.request = null;
    if (!outcome.ok) {
      setPhase("idle");
      if (outcome.reason !== "cancelled") setMessage(outcome.message);
      return;
    }
    open.current.stream = outcome.stream;
    setStream(outcome.stream);
    setPhase("live");
  }

  async function capture() {
    if (!videoRef.current || capturing.current) return;
    capturing.current = true;
    const live = open.current.stream;
    let file: File | null;
    try {
      file = await snapshot(videoRef.current);
    } finally {
      capturing.current = false;
    }
    // Cancelled while the snapshot was being drawn: the photo is dropped.
    if (open.current.stream !== live) return;
    if (!file) {
      setMessage(SNAPSHOT_FAILED);
      return;
    }
    close();
    onPhoto(file);
  }

  async function fromCameraApp(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so taking the same photo name again still counts as a change.
    if (inputRef.current) inputRef.current.value = "";
    if (file) onPhoto(await resize(file));
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        ref={takeRef}
        onClick={() => void start()}
        disabled={phase !== "idle"}
        className={buttonClass}
      >
        Take photo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={facing}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void fromCameraApp(event)}
      />

      {phase === "starting" && (
        <div className="grid gap-2">
          <p role="status" className="text-sm text-foreground/70">
            Starting the camera… Allow it in the browser&apos;s prompt.
          </p>
          <button type="button" onClick={() => close()} className={buttonClass}>
            Cancel
          </button>
        </div>
      )}

      {phase === "live" && (
        <div
          role="dialog"
          aria-label="Camera"
          onKeyDown={(event) => event.key === "Escape" && close()}
          className="grid gap-3 border border-foreground/15 p-3"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Live camera preview"
            className={`max-h-[60vh] w-full bg-foreground/10 object-contain ${facing === "user" ? "-scale-x-100" : ""}`}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void capture()}
              autoFocus
              className="min-h-11 bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => close()}
              className={buttonClass}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="alert" className="text-sm text-[var(--error)]">
          {message}
        </p>
      )}
    </div>
  );
}
