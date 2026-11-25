// The nav badge photo for the history pages (D29), as on the import page: a signed
// link to the user's avatar, or null (the badge shows the initial) when storage is
// not set up or fails.
import "server-only";
import { signAvatar } from "@/lib/photos/gallery";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/storage";

export async function navAvatar(userId: string): Promise<string | null> {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });
    return await signAvatar(userId, profile?.image ?? null, getPhotoStorage());
  } catch (error) {
    console.error("[history] couldn't sign the avatar link", { userId, error });
    return null;
  }
}
