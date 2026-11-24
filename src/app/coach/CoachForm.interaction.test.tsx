// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import CoachForm from "./CoachForm";

const encoder = new TextEncoder();
let controller: ReadableStreamDefaultController<Uint8Array>;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(value) {
            controller = value;
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function submit() {
  render(<CoachForm />);
  fireEvent.change(screen.getByLabelText("Message the coach"), {
    target: { value: "How long should I rest?" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Send" }).closest("form")!,
  );
}
describe("streaming coach form", () => {
  it("shows a sentence before the stream ends and refreshes only after saved", async () => {
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await act(async () => {
      controller.enqueue(
        encoder.encode('{"type":"delta","text":"Rest 90 seconds. "}\n'),
      );
    });
    await screen.findByRole("log", { name: "Coach reply" });
    expect(screen.getByRole("log", { name: "Coach reply" }).textContent).toBe(
      "Rest 90 seconds.",
    );
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      controller.enqueue(encoder.encode('{"type":"saved"}\n'));
      controller.close();
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ message: "How long should I rest?" }),
    );
  });
  it("keeps partial text and a Send again option after a network interruption", async () => {
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await act(async () => {
      controller.enqueue(
        encoder.encode('{"type":"delta","text":"Rest 90 seconds."}\n'),
      );
      controller.close();
    });
    expect(
      await screen.findByRole("button", { name: "Send again" }),
    ).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Rest 90 seconds.");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("shows a tier denial without rendering a successful exchange", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "Trial or Pro required" }, { status: 403 }),
    );
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Trial or Pro required",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
  it("sends the selected quick reply instead of the typed message", async () => {
    render(<CoachForm />);
    fireEvent.change(screen.getByLabelText("Message the coach"), {
      target: { value: "Typed message" },
    });
    const button = screen.getByRole("button", { name: "Too hard" });
    fireEvent(
      button.closest("form")!,
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: button,
      }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ message: "Too hard" }),
    );
    await act(async () => {
      controller.enqueue(encoder.encode('{"type":"saved"}\n'));
      controller.close();
    });
  });
  it("does not open a second request while one is in flight", async () => {
    submit();
    const form = screen.getByRole("button", { name: "Send" }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await act(async () => {
      controller.enqueue(encoder.encode('{"type":"saved"}\n'));
      controller.close();
    });
  });
  it("aborts the request when leaving the page", async () => {
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    cleanup();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      controller.close();
    });
  });
});
