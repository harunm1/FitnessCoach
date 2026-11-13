import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/account/profile-photo-actions", () => ({
  uploadProfilePhoto: vi.fn(),
  editProfilePhoto: vi.fn(),
  removeProfilePhoto: vi.fn(),
}));
import {
  canShowImage,
  framingForm,
  latestResult,
  ProfilePhotoForm,
} from "./profile-photo-form";

const EDIT_URL = "https://r2.example/me.original.webp";
const EDIT_KEY = "profile/u1/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp";

describe("profile photo form", () => {
  it("offers only to add a photo when there is none", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />,
    );
    expect(html).toContain("Add photo");
    expect(html).not.toContain("Edit photo");
    expect(html).not.toContain("Remove photo");
  });

  it("offers to change, edit or remove an existing photo", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto editUrl={EDIT_URL} editKey={EDIT_KEY} />,
    );
    expect(html).toContain("Change photo");
    expect(html).toContain("Edit photo");
    expect(html).toContain("Remove photo");
  });

  it("hides the edit button when the photo can't be edited", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto editUrl={null} editKey={null} />,
    );
    expect(html).toContain("Change photo");
    expect(html).not.toContain("Edit photo");
  });

  it("only lets the user choose the image types the server accepts", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />,
    );
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
  });

  it("has a closed editor with a zoom control and a labelled title", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />,
    );
    expect(html).toMatch(/<dialog[^>]*aria-labelledby="[^"]+-title"/);
    expect(html).not.toMatch(/<dialog[^>]* open/);
    expect(html).toContain("Edit your photo");
    expect(html).toContain('type="range"');
    expect(html).toContain('max="3"');
  });

  it("shows no message before anything happens", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto editUrl={EDIT_URL} editKey={EDIT_KEY} />,
    );
    expect(html).not.toContain('role="alert"');
    // The status area is there, empty, so screen readers announce saves.
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/);
  });

  it("tells users big photos are fine", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />,
    );
    expect(html).toContain("up to 50 MB");
  });
});

describe("latestResult", () => {
  const idle = { status: "idle" as const };
  const failed = { status: "error" as const, message: "Upload failed." };

  it("shows nothing before any action", () => {
    expect(
      latestResult(null, { upload: failed, edit: idle, remove: idle }),
    ).toBeNull();
  });

  it("shows only the latest action, not an older error", () => {
    expect(
      latestResult("edit", {
        upload: failed,
        edit: { status: "saved" },
        remove: idle,
      }),
    ).toEqual({ kind: "status", text: "Photo saved." });
  });

  it("shows the latest action's error", () => {
    expect(
      latestResult("upload", { upload: failed, edit: idle, remove: idle }),
    ).toEqual({ kind: "error", text: "Upload failed." });
  });

  it("confirms a removal", () => {
    expect(
      latestResult("remove", {
        upload: idle,
        edit: idle,
        remove: { status: "removed" },
      }),
    ).toEqual({ kind: "status", text: "Photo removed." });
  });

  it("gives a general message if an error has none", () => {
    expect(
      latestResult("edit", {
        upload: idle,
        edit: { status: "error" },
        remove: idle,
      }),
    ).toEqual({ kind: "error", text: "Something went wrong. Try again." });
  });
});

describe("framingForm", () => {
  const area = { x: 10.5, y: 20, width: 300, height: 300 };

  it("sends a new photo with its framing", () => {
    const file = new File(["photo"], "me.jpg");
    const data = framingForm(area, { file });
    expect(data.get("photo")).toBe(file);
    expect(data.has("photoKey")).toBe(false);
    expect(data.get("cropLeft")).toBe("10.5");
    expect(data.get("cropTop")).toBe("20");
    expect(data.get("cropWidth")).toBe("300");
    expect(data.get("cropHeight")).toBe("300");
  });

  it("sends the framing and which photo it is for when editing", () => {
    const data = framingForm(area, { key: EDIT_KEY });
    expect(data.has("photo")).toBe(false);
    expect(data.get("photoKey")).toBe(EDIT_KEY);
    expect(data.get("cropWidth")).toBe("300");
  });
});

describe("canShowImage", () => {
  // A stand-in for the browser's Image: it "loads" only the given address.
  function fakeImage(loads: string) {
    return () => {
      const image = {} as HTMLImageElement;
      Object.defineProperty(image, "src", {
        set(value: string) {
          queueMicrotask(() =>
            value === loads
              ? image.onload?.(new Event("load"))
              : image.onerror?.(new Event("error")),
          );
        },
      });
      return image;
    };
  }

  it("is true when the photo can be drawn", async () => {
    expect(await canShowImage("blob:photo", fakeImage("blob:photo"))).toBe(
      true,
    );
  });

  it("is false for a file the browser can't draw", async () => {
    expect(await canShowImage("blob:text", fakeImage("blob:photo"))).toBe(
      false,
    );
  });
});
