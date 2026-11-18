import { describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_BYTES, SHRINK_SIDE } from "./limits";
import { fitInside, shrinkPhoto, type ShrinkTools } from "./shrink";

type FakeImage = { width: number; height: number; close: () => void };

// A stand-in for the browser: "decodes" to the given size and "encodes" to a
// blob whose size the test chooses for each attempt.
function tools(width: number, height: number, sizes: number[]) {
  const image: FakeImage = { width, height, close: vi.fn() };
  const encode = vi.fn(async () => {
    const size = sizes.shift();
    return size === undefined ? null : new Blob([new Uint8Array(size)]);
  });
  const fake: ShrinkTools<FakeImage> = {
    decode: vi.fn(async () => image),
    encode,
  };
  return { fake, image, encode };
}

const MB = 1024 * 1024;
const file = (bytes: number, name = "IMG_1234.HEIC.jpeg") =>
  new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });

describe("fitInside", () => {
  it("shrinks the longest side to the limit, keeping the shape", () => {
    expect(fitInside(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitInside(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
  });

  it("never enlarges a small photo", () => {
    expect(fitInside(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it("keeps at least one pixel on a very thin image", () => {
    expect(fitInside(10000, 1, 2048)).toEqual({ width: 2048, height: 1 });
  });
});

describe("shrinkPhoto", () => {
  it("sends a small photo as it is", async () => {
    const { fake, encode, image } = tools(1200, 900, []);
    const original = file(MB);
    expect(await shrinkPhoto(original, fake)).toBe(original);
    expect(encode).not.toHaveBeenCalled();
    expect(image.close).toHaveBeenCalled();
  });

  it("turns a large phone photo into a JPEG under the limit", async () => {
    const { fake, encode, image } = tools(4032, 3024, [2 * MB]);
    const smaller = await shrinkPhoto(file(12 * MB), fake);
    expect(encode).toHaveBeenCalledWith(image, SHRINK_SIDE, 1536, 0.9);
    expect(smaller.size).toBe(2 * MB);
    expect(smaller.type).toBe("image/jpeg");
    expect(smaller.name).toBe("IMG_1234.HEIC.jpg");
    expect(image.close).toHaveBeenCalled();
  });

  it("shrinks a light file with too many pixels", async () => {
    const { fake, encode } = tools(8000, 6000, [MB]);
    expect((await shrinkPhoto(file(MB), fake)).size).toBe(MB);
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it("tries lower quality, then a smaller size, until it fits", async () => {
    const { fake, encode, image } = tools(4000, 4000, [
      MAX_UPLOAD_BYTES + 1,
      MAX_UPLOAD_BYTES + 1,
      MAX_UPLOAD_BYTES,
    ]);
    const smaller = await shrinkPhoto(file(20 * MB), fake);
    expect(encode.mock.calls).toEqual([
      [image, 2048, 2048, 0.9],
      [image, 2048, 2048, 0.75],
      [image, 1600, 1600, 0.75],
    ]);
    expect(smaller.size).toBe(MAX_UPLOAD_BYTES);
  });

  it("gives back the original when nothing fits, so the form can explain", async () => {
    const big = MAX_UPLOAD_BYTES + 1;
    const { fake } = tools(4000, 4000, [big, big, big]);
    const original = file(20 * MB);
    expect(await shrinkPhoto(original, fake)).toBe(original);
  });

  it("gives back the original when the browser can't draw it", async () => {
    const { fake } = tools(4000, 4000, []);
    const original = file(20 * MB);
    expect(await shrinkPhoto(original, fake)).toBe(original);
  });

  it("gives back the original when the browser can't read it", async () => {
    const original = file(20 * MB);
    const fake: ShrinkTools<FakeImage> = {
      decode: vi.fn().mockRejectedValue(new Error("not an image")),
      encode: vi.fn(),
    };
    expect(await shrinkPhoto(original, fake)).toBe(original);
    expect(fake.encode).not.toHaveBeenCalled();
  });

  it("releases the image even if drawing fails", async () => {
    const { fake, image } = tools(4000, 4000, []);
    fake.encode = vi.fn().mockRejectedValue(new Error("out of memory"));
    const original = file(20 * MB);
    expect(await shrinkPhoto(original, fake)).toBe(original);
    expect(image.close).toHaveBeenCalled();
  });

  it("names a file without an extension photo.jpg", async () => {
    const { fake } = tools(4000, 3000, [MB]);
    expect((await shrinkPhoto(file(20 * MB, ".jpeg"), fake)).name).toBe(
      "photo.jpg",
    );
  });
});
