import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/progress/photos/actions", () => ({
  uploadProgressPhoto: vi.fn(),
  deleteProgressPhoto: vi.fn(),
}));
import { DeletePhotoButton } from "./DeletePhotoButton";
import { PhotoUploadForm, shrinkThenUpload } from "./PhotoUploadForm";

const idle = { status: "idle" as const };
const MB = 1024 * 1024;
const photo = (bytes: number) =>
  new File([new Uint8Array(bytes)], "IMG_1.jpeg", { type: "image/jpeg" });
function form(file: File) {
  const data = new FormData();
  data.set("photo", file);
  data.set("note", "Week 4");
  return data;
}

describe("PhotoUploadForm", () => {
  const html = renderToStaticMarkup(<PhotoUploadForm />);

  it("sends the field names the upload action reads", () => {
    expect(html).toContain('name="photo"');
    expect(html).toContain('name="weightKg"');
    expect(html).toContain('name="note"');
  });

  it("tells users big photos are fine, but may lose some sharpness", () => {
    expect(html).toContain("up to 50 MB");
    expect(html).toContain("may look a little less sharp");
  });

  it("only offers the image types the server accepts", () => {
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
  });

  it("matches the server's limits for weight and note", () => {
    expect(html).toContain('min="20"');
    expect(html).toContain('max="400"');
    expect(html).toContain('maxLength="300"');
  });

  it("shows no message before anything is uploaded", () => {
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });
});

describe("shrinkThenUpload", () => {
  it("uploads the shrunk photo with the other fields", async () => {
    const smaller = photo(2 * MB);
    const shrink = vi.fn().mockResolvedValue(smaller);
    const upload = vi.fn().mockResolvedValue({ status: "saved" });
    const original = photo(12 * MB);
    expect(
      await shrinkThenUpload(idle, form(original), upload, shrink),
    ).toEqual({ status: "saved" });
    expect(shrink).toHaveBeenCalledWith(original);
    const sent: FormData = upload.mock.calls[0][1];
    expect(sent.get("photo")).toBe(smaller);
    expect(sent.get("note")).toBe("Week 4");
  });

  it("accepts a 50 MB photo but not a bigger one", async () => {
    const shrink = vi.fn(async () => photo(MB));
    const upload = vi.fn().mockResolvedValue({ status: "saved" });
    await shrinkThenUpload(idle, form(photo(50 * MB)), upload, shrink);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(
      await shrinkThenUpload(idle, form(photo(50 * MB + 1)), upload, shrink),
    ).toEqual({ status: "error", message: "Photos can be up to 50 MB." });
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("explains, without sending, when the photo can't be made small enough", async () => {
    const original = photo(12 * MB);
    const shrink = vi.fn().mockResolvedValue(original);
    const upload = vi.fn();
    expect(
      await shrinkThenUpload(idle, form(original), upload, shrink),
    ).toEqual({
      status: "error",
      message: "That photo is too large to upload. Try a smaller one.",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("leaves a missing photo for the server to explain", async () => {
    const shrink = vi.fn();
    const upload = vi.fn().mockResolvedValue({ status: "error" });
    await shrinkThenUpload(idle, new FormData(), upload, shrink);
    expect(shrink).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalled();
  });
});

describe("DeletePhotoButton", () => {
  const html = renderToStaticMarkup(
    <DeletePhotoButton photoId={7} takenOn="Nov 12, 2026" />,
  );

  it("sends the photo id the delete action reads", () => {
    expect(html).toContain('name="photoId"');
    expect(html).toContain('value="7"');
  });

  it("says which photo each button deletes, for screen readers", () => {
    expect(html).toContain('aria-label="Delete photo from Nov 12, 2026"');
  });
});
