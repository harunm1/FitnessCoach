import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, PhotoError, processPhoto } from "./process";

// Makes a plain test image, so no photo files are needed in the repo.
function image(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: "#4a7" },
  });
}

describe("processPhoto", () => {
  it("removes hidden data such as GPS location", async () => {
    const input = await image(40, 20)
      .jpeg()
      .withExif({
        IFD0: { Make: "TestPhone" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "43/1 39/1 0/1" },
      })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const { body } = await processPhoto(input);
    const out = await sharp(body).metadata();
    expect(out.exif).toBeUndefined();
    expect(out.xmp).toBeUndefined();
    expect(out.icc).toBeUndefined();
  });

  it("turns a sideways phone photo upright", async () => {
    // Orientation 6 means "rotate 90° to view", as phones save portrait shots.
    const input = await image(40, 20)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const photo = await processPhoto(input);
    expect([photo.width, photo.height]).toEqual([20, 40]);
    expect((await sharp(photo.body).metadata()).orientation).toBeUndefined();
  });

  it("saves the photo as WebP", async () => {
    const photo = await processPhoto(await image(40, 20).jpeg().toBuffer());
    expect(photo.contentType).toBe("image/webp");
    expect((await sharp(photo.body).metadata()).format).toBe("webp");
  });

  it("shrinks large photos to fit 1600 px, keeping their shape", async () => {
    const photo = await processPhoto(await image(4000, 2000).png().toBuffer());
    expect([photo.width, photo.height]).toEqual([1600, 800]);
  });

  it("does not enlarge small photos", async () => {
    const photo = await processPhoto(await image(400, 300).png().toBuffer());
    expect([photo.width, photo.height]).toEqual([400, 300]);
  });

  it("accepts PNG and WebP as well as JPEG", async () => {
    await expect(
      processPhoto(await image(10, 10).png().toBuffer()),
    ).resolves.toBeDefined();
    await expect(
      processPhoto(await image(10, 10).webp().toBuffer()),
    ).resolves.toBeDefined();
  });

  it("rejects an empty upload", async () => {
    await expect(processPhoto(Buffer.alloc(0))).rejects.toThrow(
      "Choose a photo to upload.",
    );
  });

  it("rejects files over 10 MB before reading them", async () => {
    await expect(
      processPhoto(Buffer.alloc(MAX_UPLOAD_BYTES + 1)),
    ).rejects.toThrow("Photos can be up to 10 MB.");
  });

  it("rejects a file that is not an image", async () => {
    await expect(processPhoto(Buffer.from("not a photo"))).rejects.toThrow(
      "That file isn't an image we can read.",
    );
  });

  it("rejects image formats other than JPEG, PNG and WebP", async () => {
    const gif = await image(10, 10).gif().toBuffer();
    await expect(processPhoto(gif)).rejects.toThrow(
      "Upload a JPEG, PNG or WebP photo.",
    );
  });

  it("rejects images with too many pixels", async () => {
    // Small as a file but huge once opened, which could exhaust memory.
    const huge = await image(8000, 6000).png().toBuffer();
    expect(huge.length).toBeLessThan(MAX_UPLOAD_BYTES);
    await expect(processPhoto(huge)).rejects.toThrow(
      "That photo couldn't be processed. Try another one.",
    );
  });

  it("only throws PhotoError, so its message is safe to show", async () => {
    await expect(processPhoto(Buffer.from("x"))).rejects.toBeInstanceOf(
      PhotoError,
    );
  });
});
