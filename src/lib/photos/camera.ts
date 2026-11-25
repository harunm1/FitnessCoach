// Taking a photo with the camera (D37). The browser parts (the camera, the
// canvas) are behind small interfaces so they can be tested; the real ones are
// at the bottom. Everything here runs in the browser only.
import { fitInside, jpegName, type DecodedImage } from "./shrink";

// The longest side of a photo taken in the app, and its JPEG quality.
export const CAPTURE_SIDE = 1600;
const CAPTURE_QUALITY = 0.85;

// What the photo is read from: a file from a phone camera, or a video frame.
export type CaptureSource = Blob | HTMLVideoElement;

export type CameraTools<Image extends DecodedImage> = {
  decode(source: CaptureSource): Promise<Image>;
  encode(
    image: Image,
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob | null>;
};

// Draws the current frame of a live video as a JPEG of at most CAPTURE_SIDE,
// or returns null when the browser can't draw it.
export async function snapshotToFile<Image extends DecodedImage>(
  video: HTMLVideoElement,
  tools: CameraTools<Image>,
): Promise<File | null> {
  let image: Image;
  try {
    image = await tools.decode(video);
  } catch {
    return null;
  }
  try {
    const size = fitInside(image.width, image.height, CAPTURE_SIDE);
    const blob = await tools.encode(
      image,
      size.width,
      size.height,
      CAPTURE_QUALITY,
    );
    return blob
      ? new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })
      : null;
  } catch {
    return null;
  } finally {
    image.close();
  }
}

// Makes a photo from the phone's camera app fit CAPTURE_SIDE as a JPEG. A
// JPEG that already fits is kept as it is. When the browser can't read the
// file, it is returned unchanged and the server explains what is wrong, as
// shrinkPhoto does.
export async function resizeCaptured<Image extends DecodedImage>(
  file: File,
  tools: CameraTools<Image>,
): Promise<File> {
  let image: Image;
  try {
    image = await tools.decode(file);
  } catch {
    return file;
  }
  try {
    const longest = Math.max(image.width, image.height);
    if (file.type === "image/jpeg" && longest <= CAPTURE_SIDE) return file;
    const size = fitInside(image.width, image.height, CAPTURE_SIDE);
    const blob = await tools.encode(
      image,
      size.width,
      size.height,
      CAPTURE_QUALITY,
    );
    return blob
      ? new File([blob], jpegName(file.name), { type: "image/jpeg" })
      : file;
  } catch {
    return file;
  } finally {
    image.close();
  }
}

// A phone or tablet has a camera app worth using; a computer gets the webcam
// preview. "Coarse pointer" means the main input is a finger.
export function prefersNativeCamera(
  match: ((query: string) => { matches: boolean }) | undefined = browserMatch(),
): boolean {
  return match?.("(pointer: coarse)").matches ?? false;
}

function browserMatch() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? (query: string) => window.matchMedia(query)
    : undefined;
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export type CameraFailure =
  "denied" | "none" | "unsupported" | "failed" | "cancelled";

export type CameraOutcome =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: CameraFailure; message: string };

const FILE_PICKER_HINT = "Choose a photo from your files instead.";

const FAILURE_MESSAGES: Record<CameraFailure, string> = {
  denied: `Camera access was blocked. ${FILE_PICKER_HINT}`,
  none: `No camera was found. ${FILE_PICKER_HINT}`,
  unsupported: `This browser can't open the camera here. ${FILE_PICKER_HINT}`,
  failed: `The camera couldn't start. ${FILE_PICKER_HINT}`,
  cancelled: "",
};

function fail(reason: CameraFailure): CameraOutcome {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

// getUserMedia's error names (MDN, checked 25 Nov 2026), grouped by what the
// person can do about them.
const DENIED = ["NotAllowedError", "PermissionDeniedError", "SecurityError"];
const NONE = ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"];

function reasonFor(error: unknown): CameraFailure {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (DENIED.includes(name)) return "denied";
  if (NONE.includes(name)) return "none";
  return "failed";
}

export type CameraRequest = {
  result: Promise<CameraOutcome>;
  // Call when the person closes the preview before the camera answered.
  cancel(): void;
};

function browserMedia(): Pick<MediaDevices, "getUserMedia"> | undefined {
  // Undefined on a page that isn't https or localhost.
  return typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
}

// Asks for the camera; call it only after the person tapped Take photo. The
// browser may never answer if the prompt is ignored (MDN), so a request that
// was cancelled stops a stream that arrives late instead of leaving the
// camera light on.
export function requestCamera(
  facing: "user" | "environment",
  media: Pick<MediaDevices, "getUserMedia"> | undefined = browserMedia(),
): CameraRequest {
  let cancelled = false;
  if (!media) {
    return { result: Promise.resolve(fail("unsupported")), cancel: () => {} };
  }
  // An async function runs up to its first await at once, so the browser is
  // asked before this function returns.
  const result = (async (): Promise<CameraOutcome> => {
    try {
      const stream = await media.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      if (!cancelled) return { ok: true, stream };
      stopStream(stream);
      return fail("cancelled");
    } catch (error) {
      return fail(cancelled ? "cancelled" : reasonFor(error));
    }
  })();
  return {
    result,
    cancel: () => {
      cancelled = true;
    },
  };
}

// The real thing: a video frame or a file is read into a bitmap and drawn on
// a canvas as a JPEG. A transparent PNG gets a white background.
export const browserCameraTools: CameraTools<ImageBitmap> = {
  decode: (source) =>
    createImageBitmap(
      source,
      source instanceof Blob ? { imageOrientation: "from-image" } : undefined,
    ),
  encode(image, width, height, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return Promise.resolve(null);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
  },
};
