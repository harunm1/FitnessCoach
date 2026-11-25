// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/session/actions", () => ({
  logSet: vi.fn(),
}));
vi.mock("@/app/account/unit-actions", () => ({ setWeightUnit: vi.fn() }));

import SetLogForm from "./SetLogForm";

afterEach(cleanup);

describe("SetLogForm pain traffic light", () => {
  it("does not show a status before either pain field has a value", () => {
    render(<SetLogForm exerciseId="squat" targetReps={10} nextSetNumber={1} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows repeat and keeps set logging enabled", () => {
    render(<SetLogForm exerciseId="squat" targetReps={10} nextSetNumber={1} />);

    fireEvent.change(screen.getByLabelText("Pain during"), {
      target: { value: "2" },
    });
    fireEvent.change(
      screen.getByLabelText("Pain this morning (before workout)"),
      {
        target: { value: "1" },
      },
    );

    expect(screen.getByRole("status").textContent).toContain("repeat");
    expect(
      (screen.getByRole("button", { name: "Log set 1" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows hold and keeps set logging enabled", () => {
    render(<SetLogForm exerciseId="squat" targetReps={10} nextSetNumber={2} />);

    fireEvent.change(screen.getByLabelText("Pain during"), {
      target: { value: "5" },
    });

    expect(screen.getByRole("status").textContent).toContain("hold");
    expect(
      (screen.getByRole("button", { name: "Log set 2" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows stop when only this morning's score is entered", () => {
    render(<SetLogForm exerciseId="squat" targetReps={10} nextSetNumber={1} />);
    fireEvent.change(
      screen.getByLabelText("Pain this morning (before workout)"),
      { target: { value: "6" } },
    );
    expect(screen.getByRole("status").textContent).toContain("stop");
  });

  it("shows stop and allows saving the stop-scored set", () => {
    render(<SetLogForm exerciseId="squat" targetReps={10} nextSetNumber={3} />);

    fireEvent.change(screen.getByLabelText("Pain during"), {
      target: { value: "6" },
    });

    expect(screen.getByRole("status").textContent).toContain("stop");
    expect(screen.getByRole("status").textContent).toContain(
      "stop the exercise",
    );
    expect(
      (screen.getByRole("button", { name: "Log set 3" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("disables set logging when this exercise is already blocked", () => {
    render(
      <SetLogForm
        exerciseId="squat"
        targetReps={10}
        nextSetNumber={4}
        blocked
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("blocked");
    expect(
      (screen.getByRole("button", { name: "Log set 4" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("offers a correction for a recorded stop score instead of logging another set", () => {
    render(
      <SetLogForm
        exerciseId="squat"
        targetReps={10}
        nextSetNumber={2}
        blocked
        correction={{
          setNumber: 1,
          reps: 8,
          weightKg: "12",
          painDuringSession: 6,
          painNextMorning: null,
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Correct logged set 1" }),
    );
    expect(
      (screen.getByLabelText("Pain during") as HTMLInputElement).value,
    ).toBe("6");
    expect((screen.getByLabelText("REPS") as HTMLInputElement).value).toBe("8");
    expect(
      (
        screen.getByRole("button", {
          name: "Save correction for set 1",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      document.querySelector<HTMLInputElement>('input[name="setNumber"]')
        ?.value,
    ).toBe("1");
    expect(screen.queryByText(/Record next-morning pain/)).toBeNull();
  });
});
