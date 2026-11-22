// Tests for the quiz answers helpers (#138, #143): exclusive Bodyweight, the split sentence, saved answers.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANSWERS,
  answersFromProfile,
  splitSentence,
  toggleEquipment,
} from "./answers";

describe("toggleEquipment", () => {
  it("makes Bodyweight exclusive when it is ticked", () => {
    expect(toggleEquipment(["barbell", "cable"], "body only", true)).toEqual([
      "body only",
    ]);
  });

  it("drops Bodyweight when another item is ticked", () => {
    expect(toggleEquipment(["body only"], "barbell", true)).toEqual([
      "barbell",
    ]);
  });

  it("adds and removes ordinary items", () => {
    expect(toggleEquipment(["barbell"], "cable", true)).toEqual([
      "barbell",
      "cable",
    ]);
    expect(toggleEquipment(["barbell", "cable"], "barbell", false)).toEqual([
      "cable",
    ]);
  });

  it("does not add an item twice", () => {
    expect(toggleEquipment(["barbell"], "barbell", true)).toEqual(["barbell"]);
  });
});

describe("splitSentence", () => {
  it("says every day is a strength day in strength mode", () => {
    expect(splitSentence(3, "STRENGTH", "GYM")).toBe("3 strength days");
  });

  it("states the strength and run days for Both, as the plan will build them", () => {
    // 3 days, fat loss, both: 2 strength and 1 run (splitDays in hybridWeek.ts).
    expect(splitSentence(3, "FAT_LOSS", "BOTH")).toBe(
      "2 strength days and 1 run day",
    );
    expect(splitSentence(1, "STRENGTH", "BOTH")).toBe("1 strength day");
  });

  it("states the split for running mode", () => {
    expect(splitSentence(4, "GENERAL_FITNESS", "RUNNING")).toBe(
      "2 strength days and 2 run days",
    );
    expect(splitSentence(2, "GENERAL_FITNESS", "RUNNING")).toBe("2 run days");
  });
});

describe("answersFromProfile", () => {
  it("uses the defaults, with no experience chosen, when there is no profile", () => {
    expect(answersFromProfile(null)).toEqual(DEFAULT_ANSWERS);
    expect(DEFAULT_ANSWERS.level).toBe("");
  });

  it("drops Bodyweight from an old profile that holds it with other items", () => {
    const row = {
      goal: "STRENGTH" as const,
      level: "EXPERT" as const,
      trainingMode: "GYM" as const,
      daysPerWeek: 3,
      equipment: ["body only", "barbell"],
      injuries: null,
    };
    expect(answersFromProfile(row).equipment).toEqual(["barbell"]);
    expect(
      answersFromProfile({ ...row, equipment: ["body only"] }).equipment,
    ).toEqual(["body only"]);
  });

  it("shows the saved profile's answers", () => {
    expect(
      answersFromProfile({
        goal: "FAT_LOSS",
        level: "EXPERT",
        trainingMode: "BOTH",
        daysPerWeek: 3,
        equipment: ["barbell", "cable"],
        injuries: null,
      }),
    ).toEqual({
      goal: "FAT_LOSS",
      level: "EXPERT",
      trainingMode: "BOTH",
      daysPerWeek: 3,
      equipment: ["barbell", "cable"],
      injuries: "",
    });
  });
});
