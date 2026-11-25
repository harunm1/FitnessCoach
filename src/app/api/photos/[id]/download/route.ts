import { z } from "zod";
import { getVerifiedUser } from "@/lib/auth/session";
import { downloadResponse } from "@/lib/downloads/respond";
import { photoFileName } from "@/lib/exports/names";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/storage";

export const runtime = "nodejs";

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const UNAVAILABLE = 503;
const NO_STORE = { "Cache-Control": "no-store" };
const photoIdSchema = z.coerce.number().int().positive();

const reply = (message: string, status: number) =>
  Response.json({ message }, { status, headers: NO_STORE });

// Downloads one of the signed-in user's progress photos (D33). Found by id AND the session's
// user, so another user's photo answers 404 like a photo that does not exist.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getVerifiedUser();
  if (!user) return reply("Sign in to download your photo.", UNAUTHORIZED);

  const { id } = await params;
  const photoId = photoIdSchema.safeParse(id);
  if (!photoId.success)
    return reply("That photo couldn't be found.", NOT_FOUND);

  try {
    const photo = await prisma.progressPhoto.findFirst({
      where: { id: photoId.data, userId: user.id },
      select: { storageKey: true, takenAt: true },
    });
    if (!photo) return reply("That photo couldn't be found.", NOT_FOUND);
    return await downloadResponse({
      storage: getPhotoStorage(),
      key: photo.storageKey,
      fileName: photoFileName(photo.takenAt),
      contentType: "image/webp",
    });
  } catch (error) {
    console.error("[photos] download failed", {
      userId: user.id,
      photoId: photoId.data,
      error,
    });
    return reply("The download isn't available right now.", UNAVAILABLE);
  }
}
