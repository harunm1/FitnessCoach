import Link from "next/link";
import PhotoViewer from "./PhotoViewer";
import type { GalleryPhoto } from "@/lib/photos/gallery";
import type { WeightUnit } from "@/lib/units/convert";

type PhotoStripProps = {
  // The newest photos with signed links, or null when storage is unavailable.
  photos: GalleryPhoto[] | null;
  total: number;
  weightUnit?: WeightUnit; // what the user chose (D30)
};

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  dateStyle: "medium",
});

// The newest progress photos with a link to the full gallery (#16).
export default function PhotoStrip({
  photos,
  total,
  weightUnit = "KG",
}: PhotoStripProps) {
  return (
    <section
      aria-labelledby="photos-title"
      className="border-t border-foreground/15 pt-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold" id="photos-title">
          Progress photos
        </h2>
        <Link
          className="text-xs text-foreground/60 underline underline-offset-4"
          href="/progress/photos"
        >
          {total > 0 ? `See all (${total})` : "Add a photo"}
        </Link>
      </div>
      {photos === null ? (
        <p role="alert" className="mt-2 mb-0 text-sm text-foreground/60">
          Photos can&apos;t be shown right now. Try again later.
        </p>
      ) : photos.length === 0 ? (
        <p className="mt-2 mb-0 text-sm text-foreground/60">
          No photos yet. Add one every few weeks to see how far you&apos;ve
          come.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-3 p-0">
          {photos.map((photo) => (
            <li className="list-none" key={photo.id}>
              <div className="grid gap-1">
                <PhotoViewer photo={photo} weightUnit={weightUnit} />
                <span className="text-xs text-foreground/60">
                  {dateFormat.format(photo.takenAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
