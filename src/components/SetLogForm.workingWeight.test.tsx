// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/session/actions", () => ({ logSet: vi.fn() }));
vi.mock("@/app/account/unit-actions", () => ({ setWeightUnit: vi.fn() }));

import SetLogForm from "./SetLogForm";

afterEach(cleanup);

const weightBox = () => screen.getByLabelText(/^(KG|LB)$/) as HTMLInputElement;

describe("SetLogForm starts at the working weight (D34)", () => {
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

  it("leaves a bodyweight exercise empty even with a weight on file", () => {
    render(
      <SetLogForm
        equipment="body only"
        exerciseId="pushup"
        nextSetNumber={1}
        suggestedWeightKg={null}
        targetReps={10}
      />,
    );
    expect(weightBox().value).toBe("");
  });
});
