// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/session/actions", () => ({ logSet: vi.fn() }));
vi.mock("@/app/account/unit-actions", () => ({ setWeightUnit: vi.fn() }));

import SetLogForm from "./SetLogForm";

afterEach(cleanup);

const weightBox = () => screen.getByLabelText(/^(KG|LB)$/) as HTMLInputElement;

describe("SetLogForm starts at the working weight (D36)", () => {
  it("shows the working weight in kilograms", () => {
    render(
      <SetLogForm
        exerciseId="bench"
        nextSetNumber={1}
        suggestedWeightKg={85}
        targetReps={5}
      />,
    );
    expect(weightBox().value).toBe("85");
  });

  it("shows it in pounds when the user chose pounds", () => {
    render(
      <SetLogForm
        exerciseId="bench"
        nextSetNumber={1}
        suggestedWeightKg={61.23}
        targetReps={5}
        weightUnit="LB"
      />,
    );
    expect(weightBox().value).toBe("135");
  });

  it("stays empty, with the hint, when there is no working weight", () => {
    render(<SetLogForm exerciseId="bench" nextSetNumber={1} targetReps={5} />);
    expect(weightBox().value).toBe("");
    expect(weightBox().placeholder).toBeTruthy();
  });

  it("says where the number comes from, so it is not mistaken for a typed value", () => {
    render(
      <SetLogForm
        exerciseId="bench"
        nextSetNumber={1}
        suggestedWeightKg={85}
        targetReps={12}
      />,
    );
    expect(screen.getByText("Lifted lately: 85 kg")).toBeTruthy();
  });

  it("shows no such note without a working weight", () => {
    render(<SetLogForm exerciseId="bench" nextSetNumber={1} targetReps={5} />);
    expect(screen.queryByText(/Lifted lately/)).toBeNull();
    expect(weightBox().value).toBe("");
  });
});
