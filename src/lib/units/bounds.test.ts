import { describe, expect, it } from "vitest";

import { distanceBounds, weightBounds } from "./convert";

describe("weightBounds", () => {
  it("keeps kilogram limits and narrows pound limits to whole pounds inside them", () => {
    expect(weightBounds(20, 400, "KG")).toEqual([20, 400]);
    // 20 kg is 44.09 lb and 400 kg is 881.85 lb, so 45 and 881 are always valid.
    expect(weightBounds(20, 400, "LB")).toEqual([45, 881]);
  });
});

describe("distanceBounds", () => {
  it("keeps kilometre limits and narrows mile limits to hundredths inside them", () => {
    expect(distanceBounds(0.1, 300, "KM")).toEqual([0.1, 300]);
    // 0.1 km is 0.0621 mi and 300 km is 186.4114 mi.
    expect(distanceBounds(0.1, 300, "MI")).toEqual([0.07, 186.41]);
  });
});
