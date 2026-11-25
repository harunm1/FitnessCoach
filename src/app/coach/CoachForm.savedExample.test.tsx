// @vitest-environment jsdom
// The chat screen shows a demo fallback reply as a saved example (D12, #59).
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

describe("coach form, saved example", () => {
  it("shows the stored reply under the saved-example label, with Send again, and does not refresh", async () => {
    render(<CoachForm />);
    fireEvent.change(screen.getByLabelText("Message the coach"), {
      target: { value: "Swap this exercise" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Send" }).closest("form")!,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    // Watches every DOM change, so even a brief live bubble with the stored text counts.
    let shownLive = false;
    const observer = new MutationObserver(() => {
      const bubble = document.querySelector('[role="log"]');
      if (bubble?.textContent?.includes("Try walking lunges."))
        shownLive = true;
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    await act(async () => {
      controller.enqueue(
        encoder.encode(
          '{"type":"example","reply":"Try walking lunges.","message":"The coach is offline."}\n',
        ),
      );
      controller.close();
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Saved example, not a live reply");
    expect(alert.textContent).toContain("Try walking lunges.");
    expect(alert.textContent).toContain("The coach is offline.");
    expect(screen.getByRole("button", { name: "Send again" })).toBeDefined();
    observer.disconnect();
    // Never shown in the live reply bubble, not even for a moment.
    expect(shownLive).toBe(false);
    expect(screen.getAllByText("Try walking lunges.")).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});
