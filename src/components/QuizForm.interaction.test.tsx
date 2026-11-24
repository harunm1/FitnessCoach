// @vitest-environment jsdom
// Interaction test for the quiz form (#138): the answers stay on screen after Save profile,
// including after a second save that returns the same message.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/onboarding/actions", () => ({ saveQuizProfile: save }));
import QuizForm from "./QuizForm";
import type { QuizAnswers } from "@/lib/onboarding/answers";

const initial: QuizAnswers = {
  goal: "STRENGTH",
  level: "EXPERT",
  trainingMode: "GYM",
  daysPerWeek: 3,
  equipment: ["body only"],
  injuries: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue({
    status: "success",
    message: "Your profile and 3-day starter plan have been saved.",
  });
});
afterEach(cleanup);

async function saveForm() {
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: /save profile|update profile/i }),
    );
  });
  await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
}

describe("QuizForm after saving", () => {
  it("keeps the saved answers on screen after one save", async () => {
    render(<QuizForm initial={initial} />);
    fireEvent.click(screen.getByLabelText("Lose body fat"));
    fireEvent.click(screen.getByLabelText("Both"));
    fireEvent.click(screen.getByLabelText("Barbell"));
    fireEvent.change(screen.getByLabelText(/Injuries or movements to avoid/), {
      target: { value: "left knee" },
    });
    await saveForm();
    expect(
      (screen.getByLabelText("Lose body fat") as HTMLInputElement).checked,
    ).toBe(true);
    expect((screen.getByLabelText("Both") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByLabelText("Barbell") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("Bodyweight") as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (
        screen.getByLabelText(
          "How would you describe your experience?",
        ) as HTMLSelectElement
      ).value,
    ).toBe("EXPERT");
    expect(
      (
        screen.getByLabelText(
          /Injuries or movements to avoid/,
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("left knee");
  });

  it("keeps them after a second save that returns the same message", async () => {
    render(<QuizForm initial={initial} />);
    await saveForm();
    fireEvent.click(screen.getByLabelText("Build muscle"));
    fireEvent.click(screen.getByLabelText("Cable machine"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /update profile/i }));
    });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(
      (screen.getByLabelText("Build muscle") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Cable machine") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("sends the current answers to the action", async () => {
    render(<QuizForm initial={initial} />);
    fireEvent.click(screen.getByLabelText("Barbell"));
    await saveForm();
    const sent = save.mock.calls[0][1] as FormData;
    expect(sent.getAll("equipment")).toEqual(["barbell"]);
    expect(sent.get("level")).toBe("EXPERT");
  });
});
