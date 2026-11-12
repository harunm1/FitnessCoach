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
  ProfilePhotoForm,
} from "./profile-photo-form";

const EDIT_URL = "https://r2.example/me.original.webp";

describe("profile photo form", () => {
  it("offers only to add a photo when there is none", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto={false} editUrl={null} />,
    );
    expect(html).toContain("Add photo");
    expect(html).not.toContain("Edit photo");
    expect(html).not.toContain("Remove photo");
  });

  it("offers to change, edit or remove an existing photo", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto editUrl={EDIT_URL} />,
    );
    expect(html).toContain("Change photo");
    expect(html).toContain("Edit photo");
    expect(html).toContain("Remove photo");
  });

  it("hides the edit button when the photo can't be edited", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto editUrl={null} />,
    );
    expect(html).toContain("Change photo");
    expect(html).not.toContain("Edit photo");
  });

  it("only lets the user choose the image types the server accepts", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto={false} editUrl={null} />,
    );
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
  });

  it("has a closed editor with a zoom control and a labelled title", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto={false} editUrl={null} />,
    );
    expect(html).toMatch(/<dialog[^>]*aria-labelledby="[^"]+-title"/);
    expect(html).not.toMatch(/<dialog[^>]* open/);
    expect(html).toContain("Edit your photo");
    expect(html).toContain('type="range"');
    expect(html).toContain('max="3"');
  });

  it("shows no message before anything happens", () => {
    const html = renderToStaticMarkup(
      <ProfilePhotoForm hasPhoto editUrl={EDIT_URL} />,
    );
    expect(html).not.toContain('role="alert"');
  });
});

describe("framingForm", () => {
  const area = { x: 10.5, y: 20, width: 300, height: 300 };

  it("sends a new photo with its framing", () => {
    const file = new File(["photo"], "me.jpg");
    const data = framingForm(area, file);
    expect(data.get("photo")).toBe(file);
    expect(data.get("cropLeft")).toBe("10.5");
    expect(data.get("cropTop")).toBe("20");
    expect(data.get("cropWidth")).toBe("300");
    expect(data.get("cropHeight")).toBe("300");
  });

  it("sends only the framing when editing the current photo", () => {
    const data = framingForm(area);
    expect(data.has("photo")).toBe(false);
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
