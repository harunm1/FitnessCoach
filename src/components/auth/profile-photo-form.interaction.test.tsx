// @vitest-environment jsdom
// Uses the form the way a person would: choose a photo, frame it, save.
// The browser parts jsdom lacks (drawing images, dialogs, the crop editor)
// are replaced with simple stand-ins below.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { actions, shrinkPhoto } = vi.hoisted(() => ({
  actions: {
    uploadProfilePhoto: vi.fn(),
    editProfilePhoto: vi.fn(),
    removeProfilePhoto: vi.fn(),
  },
  shrinkPhoto: vi.fn(),
}));
vi.mock("@/app/account/profile-photo-actions", () => actions);
vi.mock("@/lib/photos/shrink", () => ({ shrinkPhoto }));
// The real editor measures the photo on screen; this one reports a fixed
// framing as soon as it appears, like a user who doesn't move anything.
vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  return {
    default: function Cropper({
      onCropComplete,
    }: {
      onCropComplete: (area: unknown, pixels: unknown) => void;
    }) {
      useEffect(() => {
        onCropComplete(
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 10, y: 20, width: 300, height: 300 },
        );
        // Once, when the editor opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="cropper" />;
    },
  };
});
import { ProfilePhotoForm } from "./profile-photo-form";

const MB = 1024 * 1024;
const EDIT_URL = "https://r2.example/me.original.webp";
const EDIT_KEY = "profile/u1/0b9c1f0e-5d1a-4c5e-9f7a-2a1b3c4d5e6f.webp";

// A photo of the given size, without filling memory.
function photo(bytes: number, name = "me.jpg") {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

function choose(file: File) {
  const input = document.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

// Lets pending promises, timers and React updates finish.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function editorIsOpen() {
  return (document.querySelector("dialog") as HTMLDialogElement).open;
}

beforeEach(() => {
  vi.clearAllMocks();
  shrinkPhoto.mockImplementation(async (file: File) => file);
  actions.uploadProfilePhoto.mockResolvedValue({ status: "saved" });
  actions.editProfilePhoto.mockResolvedValue({ status: "saved" });
  actions.removeProfilePhoto.mockResolvedValue({ status: "removed" });
  // Every image "loads", unless its address says it is broken.
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        queueMicrotask(() =>
          value.includes("broken") ? this.onerror?.() : this.onload?.(),
        );
      }
    },
  );
  URL.createObjectURL = vi.fn(() => "blob:chosen-photo");
  URL.revokeObjectURL = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("saving through the photo editor", () => {
  it("shrinks a new photo, frames it and uploads it", async () => {
    const original = photo(12 * MB, "IMG_1.jpg");
    const smaller = photo(2 * MB, "IMG_1.jpg");
    shrinkPhoto.mockResolvedValue(smaller);
    render(<ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />);

    choose(original);
    await settle();
    expect(shrinkPhoto).toHaveBeenCalledWith(original);
    expect(editorIsOpen()).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Save photo", hidden: true }),
    );
    await settle();

    const sent: FormData = actions.uploadProfilePhoto.mock.calls[0][1];
    expect(sent.get("photo")).toBe(smaller);
    expect(sent.get("cropLeft")).toBe("10");
    expect(sent.get("cropTop")).toBe("20");
    expect(sent.get("cropWidth")).toBe("300");
    expect(screen.getByRole("status").textContent).toBe("Photo saved.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reframes the current photo without uploading a new one", async () => {
    render(<ProfilePhotoForm hasPhoto editUrl={EDIT_URL} editKey={EDIT_KEY} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit photo" }));
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: "Save photo", hidden: true }),
    );
    await settle();

    expect(actions.uploadProfilePhoto).not.toHaveBeenCalled();
    const sent: FormData = actions.editProfilePhoto.mock.calls[0][1];
    expect(sent.get("photo")).toBeNull();
    // Names the photo it was framed on, so it can't land on a newer one.
    expect(sent.get("photoKey")).toBe(EDIT_KEY);
    expect(sent.get("cropHeight")).toBe("300");
    expect(screen.getByRole("status").textContent).toBe("Photo saved.");
  });
});

describe("errors", () => {
  it("shows the server's message when saving fails", async () => {
    actions.uploadProfilePhoto.mockResolvedValue({
      status: "error",
      message: "Your photo can't be saved right now. Try again later.",
    });
    render(<ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />);
    choose(photo(MB));
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: "Save photo", hidden: true }),
    );
    await settle();

    expect(screen.getByRole("alert").textContent).toBe(
      "Your photo can't be saved right now. Try again later.",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears an old error once a later save works", async () => {
    actions.uploadProfilePhoto.mockResolvedValue({
      status: "error",
      message: "That photo couldn't be processed. Try another one.",
    });
    render(<ProfilePhotoForm hasPhoto editUrl={EDIT_URL} editKey={EDIT_KEY} />);
    choose(photo(MB));
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: "Save photo", hidden: true }),
    );
    await settle();
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit photo" }));
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: "Save photo", hidden: true }),
    );
    await settle();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Photo saved.");
  });

  it("refuses a photo over 50 MB before shrinking or sending it", async () => {
    render(<ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />);
    choose(photo(50 * MB + 1));
    await settle();

    expect(screen.getByRole("alert").textContent).toBe(
      "Photos can be up to 50 MB.",
    );
    expect(shrinkPhoto).not.toHaveBeenCalled();
    expect(actions.uploadProfilePhoto).not.toHaveBeenCalled();
  });

  it("explains, without sending, when a photo can't be made small enough", async () => {
    render(<ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />);
    choose(photo(12 * MB)); // the stand-in shrink gives it back unchanged
    await settle();

    expect(screen.getByRole("alert").textContent).toBe(
      "That photo is too large to upload. Try a smaller one.",
    );
    expect(editorIsOpen()).toBe(false);
  });

  it("explains when the chosen file isn't an image", async () => {
    URL.createObjectURL = vi.fn(() => "blob:broken");
    render(<ProfilePhotoForm hasPhoto={false} editUrl={null} editKey={null} />);
    choose(photo(MB, "notes.jpg"));
    await settle();

    expect(screen.getByRole("alert").textContent).toBe(
      "That file isn't an image we can read.",
    );
  });
});
