"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { GalleryPhoto } from "@/lib/photos/gallery";
import { photoAlt, photoCaption } from "@/lib/photos/label";
import type { WeightUnit } from "@/lib/units/convert";

// A progress photo thumbnail that opens the photo full size in a modal
// dialog (Base UI: focus moves in and is trapped, Esc and Close shut it,
// focus returns to the thumbnail). Both images use the same signed link, so
// opening it costs no extra request to storage.
export default function PhotoViewer({
  photo,
  weightUnit = "KG",
}: {
  photo: GalleryPhoto;
  weightUnit?: WeightUnit; // what the user chose (D30)
}) {
  const alt = photoAlt(photo, weightUnit);
  // The app's theme tokens live on the page's <main data-theme>, not on <html>,
  // so the dialog is portalled into that element rather than into <body>.
  const themeRoot = useRef<HTMLElement | null>(null);
  const findThemeRoot = (trigger: HTMLElement | null) => {
    themeRoot.current =
      trigger?.closest<HTMLElement>("[data-theme]") ?? document.body;
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger
        ref={findThemeRoot}
        aria-label={`Enlarge ${alt.charAt(0).toLowerCase()}${alt.slice(1)}`}
        className="block w-full cursor-zoom-in p-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {/* Signed links expire, so the image optimizer can't cache them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={alt}
          className="aspect-[3/4] w-full border border-foreground/15 object-cover"
        />
      </Dialog.Trigger>
      <Dialog.Portal container={themeRoot}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80" />
        {/* Near full screen (96% of the viewport), so the photo is as large as the screen
            allows; the thin margin and the backdrop close it on a click. Scrolls inside
            itself, so a long note stays reachable on a phone. */}
        <Dialog.Popup className="fixed inset-0 z-50 m-auto flex h-[96dvh] w-[96vw] flex-col gap-3 overflow-y-auto bg-background p-4 text-foreground outline-none">
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="m-0 text-base font-semibold">
              <span className="sr-only">Progress photo, </span>
              {photoCaption(photo, weightUnit)}
            </Dialog.Title>
            <Dialog.Close className={buttonVariants({ variant: "outline" })}>
              Close
            </Dialog.Close>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={alt}
            className="h-full min-h-[50dvh] w-full min-w-0 flex-1 object-contain"
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
