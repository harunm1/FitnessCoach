// @vitest-environment jsdom
// Opens a progress photo the way a person would: click it, read it, press Esc.
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PhotoViewer from "./PhotoViewer";

const photo = {
  id: 7,
  url: "memory://progress/u1/a.webp?expires=300",
  takenAt: new Date("2026-11-12T17:00:00Z"),
  weightKg: 81.5,
  note: "After the first block",
};

const DATE = "Nov 12, 2026";

afterEach(cleanup);

async function openViewer() {
  render(<PhotoViewer photo={photo} />);
  const trigger = screen.getByRole("button", {
    name: `Enlarge progress photo from ${DATE}, 81.5 kg`,
  });
  await act(async () => {
    fireEvent.click(trigger);
  });
  return trigger;
}

describe("PhotoViewer", () => {
  it("shows the thumbnail as a button named for the photo's date and weight", () => {
    render(<PhotoViewer photo={photo} />);
    expect(
      screen.getByRole("button", {
        name: `Enlarge progress photo from ${DATE}, 81.5 kg`,
      }),
    ).toBeTruthy();
    const thumbnail = screen.getByAltText(
      `Progress photo from ${DATE}, 81.5 kg`,
    );
    expect(thumbnail.getAttribute("src")).toBe(photo.url);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the full photo in a labelled dialog from the same signed link", async () => {
    await openViewer();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    const title = document.getElementById(
      dialog.getAttribute("aria-labelledby") ?? "",
    );
    // A hidden prefix says what the dialog shows; the dotted caption is visible.
    expect(title?.textContent).toBe(`Progress photo, ${DATE} · 81.5 kg`);
    const images = dialog.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute("src")).toBe(photo.url);
    expect(images[0].getAttribute("alt")).toBe(
      `Progress photo from ${DATE}, 81.5 kg`,
    );
    expect(dialog.textContent).toContain("After the first block");
  });

  it("moves focus into the dialog and back to the photo when Esc closes it", async () => {
    const trigger = await openViewer();
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("hides the rest of the page from assistive tech while open, inside the themed page too", async () => {
    render(
      // The dialog is portalled into this same <main>, so its siblings must
      // still be hidden while it is open.
      <main data-theme="light">
        <button type="button">Outside</button>
        <PhotoViewer photo={photo} />
      </main>,
    );
    expect(screen.getByRole("button", { name: "Outside" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^Enlarge progress photo/ }),
      );
    });
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Outside" })).toBeNull();
  });

  it("opens inside the page's theme, so dark mode applies to it", async () => {
    render(
      <main data-theme="dark">
        <PhotoViewer photo={photo} />
      </main>,
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^Enlarge progress photo/ }),
      );
    });
    const dialog = await screen.findByRole("dialog");
    expect(dialog.closest('[data-theme="dark"]')).not.toBeNull();
  });

  it("closes with the Close button", async () => {
    await openViewer();
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves out the note line when there is no note", async () => {
    render(<PhotoViewer photo={{ ...photo, note: null, weightKg: null }} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: `Enlarge progress photo from ${DATE}`,
        }),
      );
    });
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-describedby")).toBeNull();
  });
});

// Live feedback 24 Nov, item 5 (#159): the enlarged photo still read small.
describe("PhotoViewer near full screen", () => {
  it("sizes the dialog to the viewport and lets the photo fill it", async () => {
    await openViewer();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("w-[96vw]");
    expect(dialog.className).toContain("h-[96dvh]");
    const image = dialog.querySelector("img");
    expect(image?.className).toContain("object-contain");
    expect(image?.className).toContain("h-full");
    expect(image?.className).not.toContain("max-h-[70dvh]");
  });

  it("closes when the user clicks outside the photo, on the backdrop", async () => {
    await openViewer();
    await screen.findByRole("dialog");
    const backdrop = document.querySelector('[class*="bg-black"]');
    expect(backdrop).not.toBeNull();
    await act(async () => {
      fireEvent.click(backdrop as Element);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the alt text on the enlarged photo", async () => {
    await openViewer();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("img")?.getAttribute("alt")).toBe(
      `Progress photo from ${DATE}, 81.5 kg`,
    );
  });
});
