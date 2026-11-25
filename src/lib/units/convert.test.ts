import { describe, expect, it } from "vitest";

import {
  distanceLabel,
  formatDistance,
  formatBodyWeight,
  formatPace,
  formatWeight,
  fromKg,
  fromKgBody,
  fromKm,
  fromKgForEdit,
  fromKmPrecise,
  unitsFromRow,
  parseDistanceUnit,
  parseWeightUnit,
  toKg,
  toKm,
  weightLabel,
} from "./convert";

describe("toKg and fromKg", () => {
  it("leaves kilograms alone and converts pounds with the exact factor", () => {
    expect(toKg(82.5, "KG")).toBe(82.5);
    expect(toKg(45, "LB")).toBe(20.41); // 45 x 0.45359237 = 20.4117
    expect(toKg(135, "LB")).toBe(61.23); // 61.2349
  });

  it("shows pounds to the nearest half pound", () => {
    expect(fromKg(61.23, "LB")).toBe(135);
    expect(fromKg(20.41, "LB")).toBe(45);
    expect(fromKg(100, "LB")).toBe(220.5); // 220.462
  });

  it("shows kilograms to the nearest quarter kilogram", () => {
    expect(fromKg(20.41, "KG")).toBe(20.5);
    expect(fromKg(82.5, "KG")).toBe(82.5);
    expect(fromKg(82.3, "KG")).toBe(82.25);
  });

  it("round-trips every half pound from 5 to 1000 lb", () => {
    for (let lb = 5; lb <= 1000; lb += 0.5) {
      expect(fromKg(toKg(lb, "LB"), "LB")).toBe(lb);
    }
  });

  it("round-trips every quarter kilogram from 1 to 400 kg", () => {
    for (let kg = 1; kg <= 400; kg += 0.25) {
      expect(fromKg(toKg(kg, "KG"), "KG")).toBe(kg);
    }
  });
});

describe("toKm and fromKm", () => {
  it("converts miles with the exact factor to two decimals", () => {
    expect(toKm(5, "KM")).toBe(5);
    expect(toKm(5, "MI")).toBe(8.05); // 8.04672
    expect(toKm(26.2, "MI")).toBe(42.16); // 42.1648
  });

  it("shows kilometres and miles to two decimals", () => {
    expect(fromKm(5, "KM")).toBe(5);
    expect(fromKm(8.05, "MI")).toBe(5);
    expect(fromKm(10, "MI")).toBe(6.21);
  });

  it("round-trips every tenth of a mile from 0.1 to 100 mi", () => {
    for (let tenths = 1; tenths <= 1000; tenths += 1) {
      const miles = tenths / 10;
      expect(fromKm(toKm(miles, "MI"), "MI")).toBeCloseTo(miles, 1);
    }
  });
});

describe("formatting", () => {
  it("writes a weight with its unit and no trailing zeros", () => {
    expect(formatWeight(61.23, "LB")).toBe("135 lb");
    expect(formatWeight(20.41, "LB")).toBe("45 lb");
    expect(formatWeight(82.5, "KG")).toBe("82.5 kg");
    expect(formatWeight(80, "KG")).toBe("80 kg");
  });

  it("writes a distance with its unit and at most two decimals", () => {
    expect(formatDistance(8.05, "MI")).toBe("5 mi");
    expect(formatDistance(5, "KM")).toBe("5 km");
    expect(formatDistance(10, "MI")).toBe("6.21 mi");
  });

  it("writes a pace per kilometre or per mile", () => {
    expect(formatPace(5, 1800, "KM")).toBe("6:00 /km");
    expect(formatPace(5, 1800, "MI")).toBe("9:39 /mi"); // 360 s per km x 1.609344
    expect(formatPace(0, 1800, "KM")).toBeNull();
    expect(formatPace(5, null, "MI")).toBeNull();
  });

  it("names the unit", () => {
    expect(weightLabel("KG")).toBe("kg");
    expect(weightLabel("LB")).toBe("lb");
    expect(distanceLabel("KM")).toBe("km");
    expect(distanceLabel("MI")).toBe("mi");
  });
});

describe("parsing a posted unit", () => {
  it("accepts only the four known values", () => {
    expect(parseWeightUnit("KG")).toBe("KG");
    expect(parseWeightUnit("LB")).toBe("LB");
    expect(parseWeightUnit("lb")).toBeNull();
    expect(parseWeightUnit(null)).toBeNull();
    expect(parseDistanceUnit("KM")).toBe("KM");
    expect(parseDistanceUnit("MI")).toBe("MI");
    expect(parseDistanceUnit("miles")).toBeNull();
  });
});

describe("body weights", () => {
  it("shows a scale reading to 0.1 lb or 0.01 kg, not to the plate step", () => {
    expect(fromKgBody(81.3, "KG")).toBe(81.3);
    expect(fromKgBody(81.65, "LB")).toBe(180);
    expect(fromKgBody(81.83, "LB")).toBe(180.4);
    expect(formatBodyWeight(81.3, "KG")).toBe("81.3 kg");
    expect(formatBodyWeight(81.65, "LB")).toBe("180 lb");
  });

  it("round-trips a body weight typed to 0.1 lb", () => {
    for (let tenths = 800; tenths <= 4000; tenths += 1) {
      const lb = tenths / 10;
      expect(fromKgBody(toKg(lb, "LB"), "LB")).toBe(lb);
    }
  });
});

describe("prefilling a stored distance", () => {
  it("round-trips every stored hundredth of a km to 300 km through miles", () => {
    for (let hundredths = 1; hundredths <= 30000; hundredths += 1) {
      const km = hundredths / 100;
      expect(toKm(fromKmPrecise(km, "MI"), "MI")).toBe(km);
    }
  });

  it("leaves kilometres as stored", () => {
    expect(fromKmPrecise(10, "KM")).toBe(10);
    expect(fromKmPrecise(10, "MI")).toBe(6.2137);
  });
});

describe("the defaults", () => {
  it("are pounds for weight and kilometres for distance", () => {
    expect(unitsFromRow(null)).toEqual({
      weightUnit: "LB",
      distanceUnit: "KM",
    });
    expect(unitsFromRow({ weightUnit: "x", distanceUnit: 3 })).toEqual({
      weightUnit: "LB",
      distanceUnit: "KM",
    });
  });
});

describe("prefilling a stored weight for a saved correction", () => {
  it("round-trips every stored hundredth of a kg to 1000 kg through pounds", () => {
    for (let hundredths = 1; hundredths <= 100000; hundredths += 1) {
      const kg = hundredths / 100;
      expect(toKg(fromKgForEdit(kg, "LB"), "LB")).toBe(kg);
    }
  });

  it("leaves kilograms as stored and drops trailing zeros in pounds", () => {
    expect(fromKgForEdit(11.34, "KG")).toBe(11.34);
    expect(fromKgForEdit(11.34, "LB")).toBe(25);
  });
});
