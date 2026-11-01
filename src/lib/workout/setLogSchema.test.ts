import { describe, expect, it } from "vitest";
import { setLogSchema } from "./setLogSchema";

describe("setLogSchema", () => {
  it("parses reps and an optional weight from form values", () => {
    expect(setLogSchema.parse({ reps: "10", weightKg: "22.5" })).toEqual({
      reps: 10,
      weightKg: 22.5,
    });
    expect(setLogSchema.parse({ reps: "10", weightKg: "" })).toEqual({
      reps: 10,
      weightKg: undefined,
    });
  });

  it.each(["0", "31", "2.5", "not-a-number"])(
    "rejects invalid reps value %s",
    (reps) => {
      expect(setLogSchema.safeParse({ reps, weightKg: "" }).success).toBe(
        false,
      );
    },
  );

  it.each(["0", "10000", "10.123"])(
    "rejects invalid weight value %s",
    (weightKg) => {
      expect(setLogSchema.safeParse({ reps: "8", weightKg }).success).toBe(
        false,
      );
    },
  );
});
