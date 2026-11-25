// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setWeightUnit } = vi.hoisted(() => ({ setWeightUnit: vi.fn() }));
vi.mock("@/app/account/unit-actions", () => ({ setWeightUnit }));
import WeightUnitSwitch from "./WeightUnitSwitch";

beforeEach(() => {
  setWeightUnit.mockReset();
  setWeightUnit.mockResolvedValue({ status: "saved" });
});
afterEach(cleanup);

describe("WeightUnitSwitch", () => {
  it("asks to switch to the other unit and leaves the current one unclickable", () => {
    render(<WeightUnitSwitch current="LB" />);
    expect(
      (screen.getByRole("button", { name: "lb" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "kg" }));
    expect(setWeightUnit).toHaveBeenCalledWith("KG");
  });

  it("tells the user when the unit could not be changed", async () => {
    setWeightUnit.mockResolvedValue({
      status: "error",
      message: "Your unit couldn't be changed. Try again.",
    });
    render(<WeightUnitSwitch current="KG" />);
    fireEvent.click(screen.getByRole("button", { name: "lb" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "couldn't be changed",
    );
  });
});
