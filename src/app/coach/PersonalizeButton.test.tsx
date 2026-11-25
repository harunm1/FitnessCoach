// @vitest-environment jsdom
// The "Personalize with the coach" button (#58): pending label, then the action's message.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { action } = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("./personalize-action", () => ({ personalizeWithCoach: action }));
import PersonalizeButton from "./PersonalizeButton";

const COOLDOWN_SECONDS = 20;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PersonalizeButton", () => {
  it("shows a saved plan as a status message", async () => {
    action.mockResolvedValue({ status: "saved", message: "New plan saved." });
    render(<PersonalizeButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Personalize with the coach" }),
    );
    expect((await screen.findByRole("status")).textContent).toBe(
      "New plan saved.",
    );
  });

  // A plan takes seconds to write; the button must not take a second tap meanwhile.
  it("disables itself and says the coach is writing while the action runs", async () => {
    let finish: (state: unknown) => void = () => {};
    action.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<PersonalizeButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Personalize with the coach" }),
    );
    const pending = await screen.findByRole("button", {
      name: "The coach is writing your plan...",
    });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    finish({ status: "saved", message: "New plan saved." });
    expect((await screen.findByRole("status")).textContent).toBe(
      "New plan saved.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Personalize with the coach",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("shows a cooldown as an alert", async () => {
    action.mockResolvedValue({
      status: "error",
      message: "Please wait 20 seconds before requesting another plan.",
      retryAfterSeconds: COOLDOWN_SECONDS,
    });
    render(<PersonalizeButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Personalize with the coach" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Please wait 20 seconds",
    );
  });
});
