import { describe, expect, it } from "vitest";

import {
  distanceFieldToKm,
  readDistanceUnit,
  readWeightUnit,
  weightFieldToKg,
} from "./input";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe("readWeightUnit and readDistanceUnit", () => {
  it("reads the unit the form displayed", () => {
    expect(readWeightUnit(form({ weightUnit: "LB" }))).toBe("LB");
    expect(readDistanceUnit(form({ distanceUnit: "MI" }))).toBe("MI");
  });

  it("means kilograms and kilometres when the field is absent", () => {
    expect(readWeightUnit(form({}))).toBe("KG");
    expect(readDistanceUnit(form({}))).toBe("KM");
  });

  it("returns null for a value that is not a unit", () => {
    expect(readWeightUnit(form({ weightUnit: "stone" }))).toBeNull();
    expect(readDistanceUnit(form({ distanceUnit: "" }))).toBeNull();
  });
});

describe("weightFieldToKg", () => {
  it("passes kilograms through untouched", () => {
    expect(weightFieldToKg("81.5", "KG")).toBe("81.5");
  });

  it("converts typed pounds to kilograms to two decimals", () => {
    expect(weightFieldToKg("135", "LB")).toBe("61.23");
    expect(weightFieldToKg("181,5", "LB")).toBe("82.33"); // a comma keyboard
  });

  it("leaves anything that is not a plain number for the existing checks", () => {
    expect(weightFieldToKg("", "LB")).toBe("");
    expect(weightFieldToKg("abc", "LB")).toBe("abc");
    expect(weightFieldToKg("1e2", "LB")).toBe("1e2");
    expect(weightFieldToKg(null, "LB")).toBeNull();
  });
});

describe("distanceFieldToKm", () => {
  it("passes kilometres through and converts miles", () => {
    expect(distanceFieldToKm("5", "KM")).toBe("5");
    expect(distanceFieldToKm("5", "MI")).toBe("8.05");
    expect(distanceFieldToKm("abc", "MI")).toBe("abc");
  });
});
