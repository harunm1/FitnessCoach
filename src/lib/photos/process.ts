import sharp from "sharp";
import { MAX_UPLOAD_BYTES } from "./limits";

export { MAX_UPLOAD_BYTES };
const MAX_PIXELS = 40_000_000; // about a 48-megapixel phone photo
const MAX_SIDE = 1600;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

// An upload problem the user can fix; its message is safe to show them.
export class PhotoError extends Error {}

export type ProcessedPhoto = {
  body: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
};

// Checks an uploaded photo, turns it upright, removes its metadata
// (including GPS location), shrinks it to fit 1600 px and saves it as WebP.
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length === 0) {
    throw new PhotoError("Choose a photo to upload.");
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new PhotoError(
      "That photo is too large to upload. Try a smaller one.",
    );
  }

  // Check what the file really is, not what its name or type claims.
  let format: string | undefined;
  try {
    ({ format } = await sharp(input).metadata());
  } catch {
    throw new PhotoError("That file isn't an image we can read.");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new PhotoError("Upload a JPEG, PNG or WebP photo.");
  }

  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .autoOrient()
      .resize({
        width: MAX_SIDE,
        height: MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return {
      body: data,
      contentType: "image/webp",
      width: info.width,
      height: info.height,
    };
  } catch {
    throw new PhotoError("That photo couldn't be processed. Try another one.");
  }
}
