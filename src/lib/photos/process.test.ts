import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  clampCrop,
  MAX_UPLOAD_BYTES,
  PhotoError,
  processPhoto,
} from "./process";

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

  describe("square option, for profile photos", () => {
    it("crops a wide photo to a square of the given size", async () => {
      const photo = await processPhoto(
        await image(4000, 2000).png().toBuffer(),
        { square: true, maxSide: 512 },
      );
      expect([photo.width, photo.height]).toEqual([512, 512]);
      // Cropped, not shrunk with empty bars: every pixel is still the photo's
      // colour, so the green channel never drops to the black of a bar.
      const { channels } = await sharp(photo.body).stats();
      expect(channels[1].min).toBeGreaterThan(100);
    });

    it("fills the square even when the photo is small", async () => {
      const photo = await processPhoto(await image(100, 50).png().toBuffer(), {
        square: true,
        maxSide: 512,
      });
      expect([photo.width, photo.height]).toEqual([512, 512]);
    });

    it("still turns the photo upright and removes hidden data", async () => {
      const input = await image(40, 20)
        .jpeg()
        .withMetadata({ orientation: 6 })
        .withExif({
          IFD3: { GPSLatitudeRef: "N", GPSLatitude: "43/1 39/1 0/1" },
        })
        .toBuffer();
      const photo = await processPhoto(input, { square: true, maxSide: 64 });
      const out = await sharp(photo.body).metadata();
      expect(out.exif).toBeUndefined();
      expect(out.orientation).toBeUndefined();
      expect([photo.width, photo.height]).toEqual([64, 64]);
    });
  });

  describe("crop option, from the photo editor", () => {
    // 40 x 20 as stored: red left half, blue right half. Saved sideways
    // (orientation 6), so upright it is 20 x 40 with red on top.
    async function sideways() {
      const red = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "#f00" },
      })
        .png()
        .toBuffer();
      return sharp({
        create: { width: 40, height: 20, channels: 3, background: "#00f" },
      })
        .composite([{ input: red, left: 0, top: 0 }])
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();
    }

    async function colourOf(body: Buffer) {
      const { channels } = await sharp(body).stats();
      return channels.map((channel) => Math.round(channel.mean));
    }

    it("keeps only the framed part, measured on the upright photo", async () => {
      const top = await processPhoto(await sideways(), {
        square: true,
        maxSide: 16,
        crop: { left: 0, top: 0, width: 20, height: 20 },
      });
      const bottom = await processPhoto(await sideways(), {
        square: true,
        maxSide: 16,
        crop: { left: 0, top: 20, width: 20, height: 20 },
      });
      const [topRed, , topBlue] = await colourOf(top.body);
      const [bottomRed, , bottomBlue] = await colourOf(bottom.body);
      expect(topRed).toBeGreaterThan(200);
      expect(topBlue).toBeLessThan(60);
      expect(bottomBlue).toBeGreaterThan(200);
      expect(bottomRed).toBeLessThan(60);
    });

    it("still makes a square of the given size", async () => {
      const photo = await processPhoto(await image(300, 200).png().toBuffer(), {
        square: true,
        maxSide: 128,
        crop: { left: 50, top: 0, width: 200, height: 200 },
      });
      expect([photo.width, photo.height]).toEqual([128, 128]);
    });

    it("does not fail when the crop reaches past the edge", async () => {
      const photo = await processPhoto(await image(300, 200).png().toBuffer(), {
        square: true,
        maxSide: 64,
        crop: { left: 250, top: 150, width: 200, height: 200 },
      });
      expect([photo.width, photo.height]).toEqual([64, 64]);
    });
  });
});

describe("clampCrop", () => {
  it("rounds to whole pixels", () => {
    expect(
      clampCrop({ left: 10.4, top: 9.6, width: 50.5, height: 49.5 }, 300, 200),
    ).toEqual({ left: 10, top: 10, width: 51, height: 50 });
  });

  it("keeps the crop inside the photo", () => {
    expect(
      clampCrop({ left: -5, top: 190, width: 400, height: 50 }, 300, 200),
    ).toEqual({ left: 0, top: 190, width: 300, height: 10 });
  });

  it("never gives an empty crop", () => {
    expect(
      clampCrop({ left: 500, top: 500, width: 0, height: 0 }, 300, 200),
    ).toEqual({ left: 299, top: 199, width: 1, height: 1 });
  });
});
