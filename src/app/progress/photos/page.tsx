import Link from "next/link";
import { DeletePhotoButton } from "@/components/photos/DeletePhotoButton";
import { PhotoUploadForm } from "@/components/photos/PhotoUploadForm";
import { UserBadge } from "@/components/photos/UserBadge";
import { requireUser } from "@/lib/auth/session";
import {
  signAvatar,
  signPhotos,
  type GalleryPhoto,
} from "@/lib/photos/gallery";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/storage";

// Links expire, so build the page fresh on every visit.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  dateStyle: "medium",
});

export default async function ProgressPhotosPage() {
  const user = await requireUser();
  const [profile, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true },
    }),
    prisma.progressPhoto.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "desc" },
      select: {
        id: true,
        storageKey: true,
        takenAt: true,
        weightKg: true,
        note: true,
      },
    }),
  ]);

  let photos: GalleryPhoto[] | null;
  let avatarUrl: string | null = null;
  try {
    const storage = getPhotoStorage();
    [photos, avatarUrl] = await Promise.all([
      signPhotos(rows, storage),
      signAvatar(profile?.image ?? null, storage),
    ]);
  } catch {
    photos = null; // storage not set up or unreachable; show the icon
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-foreground/15 pb-5">
          <p className="text-sm font-bold tracking-[0.12em]">FORM</p>
          <div className="flex min-w-0 items-center gap-4">
            <UserBadge name={user.name} imageUrl={avatarUrl} />
            <Link
              href="/session"
              className="shrink-0 text-xs text-foreground/60 underline underline-offset-4"
            >
              Back to training
            </Link>
          </div>
        </header>

        <section className="mb-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
            Progress
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            Progress photos
          </h1>
          <p className="mt-3 text-sm text-foreground/70">
            Only you can see these. Each photo is stored privately.
          </p>
        </section>

        <PhotoUploadForm />

        <section className="mt-10">
          {photos === null ? (
            <p role="alert" className="text-sm text-foreground/70">
              Photos can&apos;t be shown right now. Try again later.
            </p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-foreground/70">
              No photos yet. Your first one becomes the starting point to
              compare against.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {photos.map((photo) => (
                <li key={photo.id} className="grid gap-2">
                  {/* Signed links expire, so the image optimizer can't cache them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`Progress photo from ${dateFormat.format(photo.takenAt)}`}
                    className="aspect-[3/4] w-full border border-foreground/15 object-cover"
                  />
                  <div className="text-xs text-foreground/70">
                    <p className="font-medium text-foreground">
                      {dateFormat.format(photo.takenAt)}
                      {photo.weightKg !== null && ` · ${photo.weightKg} kg`}
                    </p>
                    {photo.note && <p className="mt-1">{photo.note}</p>}
                  </div>
                  <DeletePhotoButton photoId={photo.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
