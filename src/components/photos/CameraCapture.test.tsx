// @vitest-environment jsdom
// Uses the camera button the way a person would. The camera itself, the
// canvas and the phone's camera app are replaced with stand-ins: the real
// webcam path runs in tests/e2e/camera.spec.ts.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CameraOutcome } from "@/lib/photos/camera";
import { CameraCapture } from "./CameraCapture";

afterEach(cleanup);

function stream() {
  const track = { stop: vi.fn() };
  return {
    track,
    stream: { getTracks: () => [track] } as unknown as MediaStream,
  };
}

// A request the test answers by hand, like a browser waiting on its prompt.
function pendingRequest() {
  let answer: (outcome: CameraOutcome) => void = () => undefined;
  const cancel = vi.fn();
  const request = vi.fn(() => ({
    result: new Promise<CameraOutcome>((resolve) => (answer = resolve)),
    cancel,
  }));
  return {
    request,
    cancel,
    answer: (outcome: CameraOutcome) => answer(outcome),
  };
}

function readyRequest(camera: MediaStream) {
  return vi.fn(() => ({
    result: Promise.resolve<CameraOutcome>({ ok: true, stream: camera }),
    cancel: vi.fn(),
  }));
}

const photo = () =>
  new File([new Uint8Array(10)], "camera-1.jpg", { type: "image/jpeg" });

describe("CameraCapture on a computer", () => {
  it("does not ask for the camera until Take photo is tapped", () => {
    const request = vi.fn();
    render(
      <CameraCapture facing="user" onPhoto={vi.fn()} requestCamera={request} />,
    );
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks for the chosen camera when Take photo is tapped, then shows the preview", async () => {
    const { stream: camera } = stream();
    const request = readyRequest(camera);
    render(
      <CameraCapture
        facing="environment"
        onPhoto={vi.fn()}
        requestCamera={request}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    expect(request).toHaveBeenCalledWith("environment");
    expect(screen.getByRole("dialog", { name: "Camera" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Capture" })).toBeTruthy();
  });

  it("hands over the snapshot, stops the camera and closes the preview", async () => {
    const { stream: camera, track } = stream();
    const onPhoto = vi.fn();
    const file = photo();
    render(
      <CameraCapture
        facing="user"
        onPhoto={onPhoto}
        requestCamera={readyRequest(camera)}
        snapshot={vi.fn(async () => file)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    });
    expect(onPhoto).toHaveBeenCalledWith(file);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stops the camera when the preview is cancelled", async () => {
    const { stream: camera, track } = stream();
    render(
      <CameraCapture
        facing="user"
        onPhoto={vi.fn()}
        requestCamera={readyRequest(camera)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stops the camera when Escape is pressed", async () => {
    const { stream: camera, track } = stream();
    render(
      <CameraCapture
        facing="user"
        onPhoto={vi.fn()}
        requestCamera={readyRequest(camera)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("stops the camera when the form is left while the preview is open", async () => {
    const { stream: camera, track } = stream();
    const { unmount } = render(
      <CameraCapture
        facing="user"
        onPhoto={vi.fn()}
        requestCamera={readyRequest(camera)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    unmount();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("cancels a request nobody answered yet when the person gives up", async () => {
    const waiting = pendingRequest();
    render(
      <CameraCapture
        facing="user"
        onPhoto={vi.fn()}
        requestCamera={waiting.request}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    expect(screen.getByRole("status").textContent).toMatch(/starting/i);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(waiting.cancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels a pending request when the form is left", async () => {
    const waiting = pendingRequest();
    const { unmount } = render(
      <CameraCapture
        facing="user"
        onPhoto={vi.fn()}
        requestCamera={waiting.request}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    unmount();
    expect(waiting.cancel).toHaveBeenCalledTimes(1);
  });

  it("explains a refused camera and leaves the file picker as the way in", async () => {
    const message =
      "Camera access was blocked. Choose a photo from your files instead.";
    const request = vi.fn(() => ({
      result: Promise.resolve<CameraOutcome>({
        ok: false,
        reason: "denied",
        message,
      }),
      cancel: vi.fn(),
    }));
    render(
      <CameraCapture facing="user" onPhoto={vi.fn()} requestCamera={request} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Take photo" })).toBeTruthy();
  });

  it("says so when the snapshot can't be taken, and keeps the preview", async () => {
    const { stream: camera } = stream();
    const onPhoto = vi.fn();
    render(
      <CameraCapture
        facing="user"
        onPhoto={onPhoto}
        requestCamera={readyRequest(camera)}
        snapshot={vi.fn(async () => null)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    });
    expect(onPhoto).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/couldn't be taken/i);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("CameraCapture edge cases from review", () => {
  it("drops a snapshot that finishes after the person cancelled", async () => {
    const { stream: camera } = stream();
    const onPhoto = vi.fn();
    let finish: (file: File | null) => void = () => undefined;
    render(
      <CameraCapture
        facing="user"
        onPhoto={onPhoto}
        requestCamera={readyRequest(camera)}
        snapshot={vi.fn(() => new Promise<File | null>((r) => (finish = r)))}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => finish(photo()));
    expect(onPhoto).not.toHaveBeenCalled();
  });

  it("takes one snapshot when Capture is pressed twice", async () => {
    const { stream: camera } = stream();
    const onPhoto = vi.fn();
    const snapshot = vi.fn(async () => photo());
    render(
      <CameraCapture
        facing="user"
        onPhoto={onPhoto}
        requestCamera={readyRequest(camera)}
        snapshot={snapshot}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    const capture = screen.getByRole("button", { name: "Capture" });
    await act(async () => {
      fireEvent.click(capture);
      fireEvent.click(capture);
    });
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(onPhoto).toHaveBeenCalledTimes(1);
  });

  it("returns focus to Take photo when the preview closes", async () => {
    const { stream: camera } = stream();
    render(
      <CameraCapture
        facing="user"
        onPhoto={vi.fn()}
        requestCamera={readyRequest(camera)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Take photo" }),
    );
  });

  it("leaves focus where the person is typing when a submit closes the preview", async () => {
    const { stream: camera } = stream();
    const { container } = render(
      <form>
        <input aria-label="Note" />
        <CameraCapture
          facing="user"
          onPhoto={vi.fn()}
          requestCamera={readyRequest(camera)}
        />
      </form>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    screen.getByLabelText("Note").focus();
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(document.activeElement).toBe(screen.getByLabelText("Note"));
  });

  it("switches the camera off when the form around it is submitted", async () => {
    const { stream: camera, track } = stream();
    const { container } = render(
      <form>
        <CameraCapture
          facing="user"
          onPhoto={vi.fn()}
          requestCamera={readyRequest(camera)}
        />
      </form>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("CameraCapture on a phone", () => {
  it("opens the phone's camera app with the chosen camera instead of the webcam", () => {
    const request = vi.fn();
    const { container } = render(
      <CameraCapture
        facing="environment"
        onPhoto={vi.fn()}
        native
        requestCamera={request}
      />,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input?.getAttribute("capture")).toBe("environment");
    expect(input?.getAttribute("accept")).toBe("image/*");
    const click = vi.spyOn(input as HTMLInputElement, "click");
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it("uses the front camera for a form selfie", () => {
    const { container } = render(
      <CameraCapture facing="user" onPhoto={vi.fn()} native />,
    );
    expect(
      container.querySelector('input[type="file"]')?.getAttribute("capture"),
    ).toBe("user");
  });

  it("resizes the photo from the camera app before handing it over", async () => {
    const onPhoto = vi.fn();
    const small = photo();
    const resize = vi.fn(async () => small);
    const { container } = render(
      <CameraCapture
        facing="environment"
        onPhoto={onPhoto}
        native
        resize={resize}
      />,
    );
    const big = new File([new Uint8Array(10)], "IMG_1.jpg", {
      type: "image/jpeg",
    });
    await act(async () => {
      fireEvent.change(container.querySelector('input[type="file"]')!, {
        target: { files: [big] },
      });
    });
    expect(resize).toHaveBeenCalledWith(big);
    expect(onPhoto).toHaveBeenCalledWith(small);
  });
});
