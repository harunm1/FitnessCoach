// @vitest-environment jsdom
// Submits the weight form the way a person would and checks what stays on screen.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { logBodyWeight } = vi.hoisted(() => ({ logBodyWeight: vi.fn() }));
vi.mock("@/app/progress/weight/actions", () => ({ logBodyWeight }));
import WeightForm from "./WeightForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function submit(weight: string, note = "") {
  fireEvent.change(screen.getByLabelText("Day"), {
    target: { value: "2026-11-20" },
  });
  fireEvent.change(screen.getByLabelText("Weight (kg)"), {
    target: { value: weight },
  });
  fireEvent.change(screen.getByLabelText("Note (optional)"), {
    target: { value: note },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save weight" }));
  });
}

describe("WeightForm", () => {
  it("keeps what was typed when the server refuses it, and reads the error out", async () => {
    logBodyWeight.mockResolvedValue({
      status: "error",
      message: "Enter a weight between 20 and 400 kg.",
      values: { date: "2026-11-20", weightKg: "5", note: "after run" },
    });
    render(<WeightForm today="2026-11-24" />);
    await submit("5", "after run");

    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a weight between 20 and 400 kg.",
    );
    expect((screen.getByLabelText("Day") as HTMLInputElement).value).toBe(
      "2026-11-20",
    );
    expect(
      (screen.getByLabelText("Weight (kg)") as HTMLInputElement).value,
    ).toBe("5");
    expect(
      (screen.getByLabelText("Note (optional)") as HTMLInputElement).value,
    ).toBe("after run");
  });

  it("announces a save in the status region and clears the form", async () => {
    logBodyWeight.mockResolvedValue({ status: "saved", date: "2026-11-20" });
    render(<WeightForm today="2026-11-24" />);
    await submit("81.5");

    expect(screen.getByRole("status").textContent).toBe(
      "Saved your weight for Nov 20, 2026.",
    );
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(
      (screen.getByLabelText("Weight (kg)") as HTMLInputElement).value,
    ).toBe("");
  });
});
