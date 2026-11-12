import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/progress/photos/actions", () => ({
  uploadProgressPhoto: vi.fn(),
  deleteProgressPhoto: vi.fn(),
}));
import { DeletePhotoButton } from "./DeletePhotoButton";
import { PhotoUploadForm } from "./PhotoUploadForm";

describe("PhotoUploadForm", () => {
  const html = renderToStaticMarkup(<PhotoUploadForm />);

  it("sends the field names the upload action reads", () => {
    expect(html).toContain('name="photo"');
    expect(html).toContain('name="weightKg"');
    expect(html).toContain('name="note"');
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

describe("DeletePhotoButton", () => {
  it("sends the photo id the delete action reads", () => {
    const html = renderToStaticMarkup(<DeletePhotoButton photoId={7} />);
    expect(html).toContain('name="photoId"');
    expect(html).toContain('value="7"');
  });
});
