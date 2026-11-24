"use client";

import { Dialog } from "@base-ui/react/dialog";
import { buttonVariants } from "@/components/ui/button";
import type { GalleryPhoto } from "@/lib/photos/gallery";
import { photoAlt, photoCaption } from "@/lib/photos/label";

type PhotoViewerProps = {
  photo: GalleryPhoto;
  // Classes for the thumbnail, so each page keeps its own grid look.
  thumbnailClassName?: string;
};

const DEFAULT_THUMBNAIL =
  "aspect-[3/4] w-full border border-foreground/15 object-cover";

// A progress photo thumbnail that opens the photo full size in a modal
// dialog (Base UI: focus moves in and is trapped, Esc and Close shut it,
// focus returns to the thumbnail). Both images use the same signed link, so
// opening it costs no extra request to storage.
export default function PhotoViewer({
  photo,
  thumbnailClassName = DEFAULT_THUMBNAIL,
}: PhotoViewerProps) {
  const alt = photoAlt(photo);
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label={`Enlarge ${alt.charAt(0).toLowerCase()}${alt.slice(1)}`}
        className="block w-full cursor-zoom-in p-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {/* Signed links expire, so the image optimizer can't cache them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={alt} className={thumbnailClassName} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Popup className="fixed inset-0 z-50 m-auto flex h-fit max-h-[95vh] w-fit max-w-[95vw] flex-col gap-3 bg-background p-4 text-foreground outline-none">
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="m-0 text-base font-semibold">
              {photoCaption(photo)}
            </Dialog.Title>
            <Dialog.Close className={buttonVariants({ variant: "outline" })}>
              Close
            </Dialog.Close>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={alt}
            className="max-h-[80vh] max-w-full object-contain"
          />
          {photo.note && (
            <Dialog.Description className="m-0 max-w-prose text-sm text-foreground/70">
              {photo.note}
            </Dialog.Description>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
