import sharp, { type Metadata } from "sharp";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PIXELS = 40_000_000; // about a 48-megapixel phone photo
const MAX_SIDE = 1600;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

// An upload problem the user can fix; its message is safe to show them.
export class PhotoError extends Error {}

// A rectangle in pixels of the upright photo, as chosen in the photo editor.
export type CropArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PhotoOptions = {
  // Longest side in pixels, or the side of the square.
  maxSide?: number;
  // Crop to a square (for profile photos, which are shown in a circle).
  square?: boolean;
  // The part of the photo the user framed in the editor.
  crop?: CropArea;
};

// Rounds a crop to whole pixels and keeps it inside the photo, so a
// slightly-off value from the browser can never make processing fail.
export function clampCrop(
  crop: CropArea,
  imageWidth: number,
  imageHeight: number,
): CropArea {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(Math.round(value), min), max);
  const left = clamp(crop.left, 0, imageWidth - 1);
  const top = clamp(crop.top, 0, imageHeight - 1);
  return {
    left,
    top,
    width: clamp(crop.width, 1, imageWidth - left),
    height: clamp(crop.height, 1, imageHeight - top),
  };
}

export type ProcessedPhoto = {
  body: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
};

// Checks an uploaded photo, turns it upright, removes its metadata
// (including GPS location), shrinks it to fit 1600 px (or crops it to a
// square) and saves it as WebP.
export async function processPhoto(
  input: Buffer,
  { maxSide = MAX_SIDE, square = false, crop }: PhotoOptions = {},
): Promise<ProcessedPhoto> {
  if (input.length === 0) {
    throw new PhotoError("Choose a photo to upload.");
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new PhotoError("Photos can be up to 10 MB.");
  }

  // Check what the file really is, not what its name or type claims.
  let metadata: Metadata;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    throw new PhotoError("That file isn't an image we can read.");
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new PhotoError("Upload a JPEG, PNG or WebP photo.");
  }

  try {
    let image = sharp(input, { limitInputPixels: MAX_PIXELS }).autoOrient();
    if (crop) {
      // The editor measures the photo the right way up, so crop after turning it.
      const { width, height } = metadata.autoOrient;
      image = image.extract(clampCrop(crop, width, height));
    }
    const { data, info } = await image
      .resize(
        square
          ? // Fill the square, keeping the most interesting part (usually a face).
            {
              width: maxSide,
              height: maxSide,
              fit: "cover",
              position: "attention",
            }
          : {
              width: maxSide,
              height: maxSide,
              fit: "inside",
              withoutEnlargement: true,
            },
      )
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
