import { describe, expect, it, vi } from "vitest";
import {
  CAPTURE_SIDE,
  prefersNativeCamera,
  requestCamera,
  resizeCaptured,
  snapshotToFile,
  stopStream,
  type CameraTools,
} from "./camera";

type FakeImage = { width: number; height: number; close: () => void };

// A stand-in for the browser: "decodes" to the given size and "encodes" to a
// small blob, recording the size it was asked to draw.
function tools(width: number, height: number, decodes = true) {
  const image: FakeImage = { width, height, close: vi.fn() };
  const encode = vi.fn(async () => new Blob([new Uint8Array(1000)]));
  const fake: CameraTools<FakeImage> = {
    decode: decodes
      ? vi.fn(async () => image)
      : vi.fn(async () => {
          throw new Error("cannot decode");
        }),
    encode,
  };
  return { fake, image, encode };
}

function fakeStream(trackCount = 1) {
  const tracks = Array.from({ length: trackCount }, () => ({ stop: vi.fn() }));
  return {
    stream: { getTracks: () => tracks } as unknown as MediaStream,
    tracks,
  };
}

const video = {} as HTMLVideoElement;

describe("snapshotToFile", () => {
  it("keeps the shape of a landscape frame and caps the long side at 1600", async () => {
    const { fake, encode } = tools(1920, 1080);
    const file = await snapshotToFile(video, fake);
    expect(encode).toHaveBeenCalledWith(expect.anything(), 1600, 900, 0.85);
    expect(file?.type).toBe("image/jpeg");
    expect(file?.name).toMatch(/^camera-.*\.jpg$/);
  });

  it("keeps the shape of a portrait frame", async () => {
    const { fake, encode } = tools(1080, 1920);
    await snapshotToFile(video, fake);
    expect(encode).toHaveBeenCalledWith(expect.anything(), 900, 1600, 0.85);
  });

  it("never enlarges a small frame", async () => {
    const { fake, encode } = tools(640, 480);
    await snapshotToFile(video, fake);
    expect(encode).toHaveBeenCalledWith(expect.anything(), 640, 480, 0.85);
  });

  it("returns nothing when the browser can't draw the frame", async () => {
    const { fake } = tools(640, 480, false);
    expect(await snapshotToFile(video, fake)).toBeNull();
  });

  it("releases the decoded frame", async () => {
    const { fake, image } = tools(640, 480);
    await snapshotToFile(video, fake);
    expect(image.close).toHaveBeenCalled();
  });
});

describe("resizeCaptured", () => {
  const phone = () =>
    new File([new Uint8Array(5000)], "IMG_0001.JPG", { type: "image/jpeg" });

  it("shrinks a 12-megapixel phone photo to 1600 px, keeping the shape", async () => {
    const { fake, encode } = tools(4032, 3024);
    const file = await resizeCaptured(phone(), fake);
    expect(encode).toHaveBeenCalledWith(expect.anything(), 1600, 1200, 0.85);
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toBe("IMG_0001.jpg");
  });

  it("leaves a JPEG that is already small enough alone", async () => {
    const { fake, encode } = tools(1200, 900);
    const original = phone();
    expect(await resizeCaptured(original, fake)).toBe(original);
    expect(encode).not.toHaveBeenCalled();
  });

  it("converts a small PNG to JPEG", async () => {
    const { fake, encode } = tools(800, 600);
    const png = new File([new Uint8Array(10)], "shot.png", {
      type: "image/png",
    });
    const file = await resizeCaptured(png, fake);
    expect(encode).toHaveBeenCalledWith(expect.anything(), 800, 600, 0.85);
    expect(file.name).toBe("shot.jpg");
  });

  it("hands back the original when the browser can't read it", async () => {
    const { fake } = tools(0, 0, false);
    const original = phone();
    expect(await resizeCaptured(original, fake)).toBe(original);
  });

  it("uses a 1600 px cap", () => {
    expect(CAPTURE_SIDE).toBe(1600);
  });
});

describe("stopStream", () => {
  it("stops every track", () => {
    const { stream, tracks } = fakeStream(2);
    stopStream(stream);
    for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
  });
});

describe("requestCamera", () => {
  it("asks for the video of the chosen camera only, never audio", async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const request = requestCamera("user", { getUserMedia } as never);
    expect(await request.result).toEqual({ ok: true, stream });
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "user" },
      audio: false,
    });
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["PermissionDeniedError", "denied"],
    ["NotFoundError", "none"],
    ["OverconstrainedError", "none"],
    ["NotReadableError", "failed"],
  ])(
    "explains %s as %s and points to the file picker",
    async (name, reason) => {
      const getUserMedia = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("x"), { name }));
      const outcome = await requestCamera("environment", {
        getUserMedia,
      } as never).result;
      expect(outcome).toMatchObject({ ok: false, reason });
      expect(outcome.ok === false && outcome.message).toMatch(
        /choose a photo/i,
      );
    },
  );

  it("falls back when the page has no camera support at all", async () => {
    const outcome = await requestCamera("user", undefined).result;
    expect(outcome).toMatchObject({ ok: false, reason: "unsupported" });
    expect(outcome.ok === false && outcome.message).toMatch(/choose a photo/i);
  });

  it("stops a stream that arrives after the request was cancelled", async () => {
    const { stream, tracks } = fakeStream();
    let grant: (value: MediaStream) => void = () => undefined;
    const getUserMedia = vi.fn(
      () => new Promise<MediaStream>((resolve) => (grant = resolve)),
    );
    const request = requestCamera("user", { getUserMedia } as never);
    request.cancel();
    grant(stream);
    expect(await request.result).toMatchObject({
      ok: false,
      reason: "cancelled",
    });
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when a cancelled request is then refused", async () => {
    let refuse: (error: Error) => void = () => undefined;
    const getUserMedia = vi.fn(
      () => new Promise<MediaStream>((_, reject) => (refuse = reject)),
    );
    const request = requestCamera("user", { getUserMedia } as never);
    request.cancel();
    refuse(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    expect(await request.result).toMatchObject({
      ok: false,
      reason: "cancelled",
    });
  });
});

describe("prefersNativeCamera", () => {
  it("is true on a touch phone and false on a computer", () => {
    const match = (coarse: boolean) =>
      (() => ({ matches: coarse })) as unknown as typeof window.matchMedia;
    expect(prefersNativeCamera(match(true))).toBe(true);
    expect(prefersNativeCamera(match(false))).toBe(false);
  });

  it("is false when the browser can't answer", () => {
    expect(prefersNativeCamera(undefined)).toBe(false);
  });
});
