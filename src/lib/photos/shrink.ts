// Makes a photo small enough to upload, in the browser, before it is sent
// (#16). Phone photos are often 5 to 15 MB, more than the 4 MB a request can
// carry on Vercel. Re-drawing the photo also turns it upright and drops its
// metadata; the server still checks and strips everything itself.
import { MAX_UPLOAD_BYTES, SHRINK_SIDE } from "./limits";

export type DecodedImage = { width: number; height: number; close(): void };

// How the photo is read and re-drawn. The browser versions are below; tests
// pass simple stand-ins.
export type ShrinkTools<Image extends DecodedImage> = {
  decode(file: Blob): Promise<Image>;
  encode(
    image: Image,
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob | null>;
};

// The size that fits inside a square of maxSide, keeping the photo's shape.
export function fitInside(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Tried in order until the result fits under the upload limit.
const ATTEMPTS = [
  { side: SHRINK_SIDE, quality: 0.9 },
  { side: SHRINK_SIDE, quality: 0.75 },
  { side: 1600, quality: 0.75 },
];

function jpegName(name: string) {
  return `${name.replace(/\.[^.]*$/, "") || "photo"}.jpg`;
}

const browserTools: ShrinkTools<ImageBitmap> = {
  decode: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  encode(image, width, height, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return Promise.resolve(null);
    // JPEG has no transparency, so a see-through PNG gets a white background.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
  },
};

// Returns a smaller JPEG, or the original file when it already fits or the
// browser can't read it (the server then explains what is wrong).
export async function shrinkPhoto<Image extends DecodedImage = ImageBitmap>(
  file: File,
  tools: ShrinkTools<Image> = browserTools as unknown as ShrinkTools<Image>,
): Promise<File> {
  let image: Image;
  try {
    image = await tools.decode(file);
  } catch {
    return file;
  }
  try {
    const longest = Math.max(image.width, image.height);
    if (file.size <= MAX_UPLOAD_BYTES && longest <= SHRINK_SIDE) return file;
    for (const attempt of ATTEMPTS) {
      const size = fitInside(image.width, image.height, attempt.side);
      const blob = await tools.encode(
        image,
        size.width,
        size.height,
        attempt.quality,
      );
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], jpegName(file.name), { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file;
  } finally {
    image.close();
  }
}
