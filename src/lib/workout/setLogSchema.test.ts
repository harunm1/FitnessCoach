import { describe, expect, it } from "vitest";
import { setLogSchema } from "./setLogSchema";

describe("setLogSchema", () => {
  it("parses reps and an optional weight from form values", () => {
    expect(
      setLogSchema.parse({ setNumber: "2", reps: "10", weightKg: "22.5" }),
    ).toEqual({ setNumber: 2, reps: 10, weightKg: 22.5 });
    expect(
      setLogSchema.parse({ setNumber: "1", reps: "10", weightKg: "" }),
    ).toEqual({ setNumber: 1, reps: 10, weightKg: undefined });
  });

  it.each(["0", "7", "1.5", "not-a-number"])(
    "rejects invalid set number %s",
    (setNumber) => {
      expect(
        setLogSchema.safeParse({ setNumber, reps: "10", weightKg: "" }).success,
      ).toBe(false);
    },
  );

  it.each(["0", "31", "2.5", "not-a-number"])(
    "rejects invalid reps value %s",
    (reps) => {
      expect(
        setLogSchema.safeParse({ setNumber: "1", reps, weightKg: "" }).success,
      ).toBe(false);
    },
  );

  it.each(["0", "10000", "10.123"])(
    "rejects invalid weight value %s",
    (weightKg) => {
      expect(
        setLogSchema.safeParse({ setNumber: "1", reps: "8", weightKg }).success,
      ).toBe(false);
    },
  );
});
