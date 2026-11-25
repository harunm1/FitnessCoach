// @vitest-environment jsdom
// The upload form with the camera button: pick the kind, take a photo, save.
// The camera button is replaced by a stand-in that "takes" a fixed photo; the
// button itself is tested in CameraCapture.test.tsx.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { upload, taken } = vi.hoisted(() => ({
  upload: vi.fn(),
  taken: { file: undefined as unknown as File },
}));
vi.mock("@/app/progress/photos/actions", () => ({
  uploadProgressPhoto: upload,
  deleteProgressPhoto: vi.fn(),
}));
vi.mock("./CameraCapture", () => ({
  CameraCapture: ({
    facing,
    onPhoto,
  }: {
    facing: string;
    onPhoto: (file: File) => void;
  }) => (
    <button type="button" onClick={() => onPhoto(taken.file)}>
      stand-in camera ({facing})
    </button>
  ),
}));
import { PhotoUploadForm } from "./PhotoUploadForm";

const exercises = [
  { id: "Barbell_Squat", name: "Barbell Squat" },
  { id: "Deadlift", name: "Deadlift" },
];

beforeEach(() => {
  upload.mockReset();
  upload.mockResolvedValue({ status: "saved" });
  taken.file = new File([new Uint8Array(10)], "camera-1.jpg", {
    type: "image/jpeg",
  });
});
afterEach(cleanup);

function fileInput(container: HTMLElement) {
  return container.querySelector('input[name="photo"]') as HTMLInputElement;
}

describe("PhotoUploadForm with the camera", () => {
  it("is a progress photo by default, with no exercise to pick", () => {
    render(<PhotoUploadForm exercises={exercises} />);
    const progress = screen.getByLabelText(
      "Progress photo",
    ) as HTMLInputElement;
    expect(progress.checked).toBe(true);
    expect(progress.name).toBe("kind");
    expect(screen.queryByLabelText(/exercise/i)).toBeNull();
    expect(screen.getByText(/stand-in camera \(environment\)/)).toBeTruthy();
  });

  it("offers the exercises for a form photo and uses the front camera", () => {
    render(<PhotoUploadForm exercises={exercises} />);
    fireEvent.click(screen.getByLabelText("Form photo"));
    const select = screen.getByLabelText(/exercise/i) as HTMLSelectElement;
    expect(select.name).toBe("exerciseId");
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "No specific exercise",
      "Barbell Squat",
      "Deadlift",
    ]);
    expect(screen.getByText(/stand-in camera \(user\)/)).toBeTruthy();
  });

  it("leaves the exercise picker out when there are no exercises to pick", () => {
    render(<PhotoUploadForm />);
    fireEvent.click(screen.getByLabelText("Form photo"));
    expect(screen.queryByLabelText(/exercise/i)).toBeNull();
  });

  it("sends the photo from the camera with its kind and exercise", async () => {
    const { container } = render(<PhotoUploadForm exercises={exercises} />);
    fireEvent.click(screen.getByLabelText("Form photo"));
    fireEvent.change(screen.getByLabelText(/exercise/i), {
      target: { value: "Deadlift" },
    });
    fireEvent.click(screen.getByText(/stand-in camera/));
    expect(screen.getByRole("status").textContent).toContain("camera-1.jpg");
    expect(fileInput(container).required).toBe(false);

    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(upload).toHaveBeenCalledTimes(1);
    const sent = upload.mock.calls[0][1] as FormData;
    expect((sent.get("photo") as File).name).toBe("camera-1.jpg");
    expect(sent.get("kind")).toBe("FORM");
    expect(sent.get("exerciseId")).toBe("Deadlift");
  });

  it("asks for a photo again after the camera photo is removed", () => {
    const { container } = render(<PhotoUploadForm />);
    fireEvent.click(screen.getByText(/stand-in camera/));
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(fileInput(container).required).toBe(true);
  });

  it("drops the camera photo when a file is chosen instead", () => {
    const { container } = render(<PhotoUploadForm />);
    fireEvent.click(screen.getByText(/stand-in camera/));
    fireEvent.change(fileInput(container), {
      target: {
        files: [
          new File([new Uint8Array(10)], "pick.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the camera photo once it is saved", async () => {
    const { container } = render(<PhotoUploadForm />);
    fireEvent.click(screen.getByText(/stand-in camera/));
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(screen.getByText("Photo saved.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
    expect(fileInput(container).required).toBe(true);
  });

  it("empties the file input when a camera photo is taken, so no old name shows", () => {
    const { container } = render(<PhotoUploadForm />);
    const input = fileInput(container);
    const clear = vi.spyOn(input, "value", "set");
    fireEvent.click(screen.getByText(/stand-in camera/));
    expect(clear).toHaveBeenCalledWith("");
  });
});
