import { getVerifiedUser } from "@/lib/auth/session";
import { downloadResponse } from "@/lib/downloads/respond";
import { exportContentType, exportFileName } from "@/lib/exports/names";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/storage";

export const runtime = "nodejs";

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const UNAVAILABLE = 503;
const NO_STORE = { "Cache-Control": "no-store" };

const reply = (message: string, status: number) =>
  Response.json({ message }, { status, headers: NO_STORE });

// Downloads one of the signed-in user's exports (D33). The row is found by id AND the session's
// user, so another user's id answers 404 exactly like an id that does not exist.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getVerifiedUser();
  if (!user) return reply("Sign in to download your data.", UNAUTHORIZED);

  const { id } = await params;
  try {
    const row = await prisma.dataExport.findFirst({
      where: { id, userId: user.id },
      select: { kind: true, r2Key: true, createdAt: true },
    });
    if (!row) return reply("That export couldn't be found.", NOT_FOUND);
    return await downloadResponse({
      storage: getPhotoStorage(),
      key: row.r2Key,
      fileName: exportFileName(row.kind, row.createdAt),
      contentType: exportContentType(row.kind),
    });
  } catch (error) {
    console.error("[exports] download failed", { userId: user.id, id, error });
    return reply("The download isn't available right now.", UNAVAILABLE);
  }
}
