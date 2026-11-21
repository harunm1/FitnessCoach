// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/session/actions", () => ({
  logSet: vi.fn(),
}));

import SetLogForm from "./SetLogForm";

afterEach(cleanup);

describe("SetLogForm pain traffic light", () => {
  it("shows repeat and keeps set logging enabled", () => {
    render(<SetLogForm exerciseId="squat" targetReps={10} nextSetNumber={1} />);

    fireEvent.change(screen.getByLabelText("Pain during"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Pain next morning"), {
      target: { value: "1" },
    });

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

  it("shows stop and disables set logging", () => {
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
    ).toBe(true);
  });
});
