// Tests for the one-line "get checked first" note shown with a plan when the profile lists an injury or condition.
import { describe, expect, it } from "vitest";
import { PLAN_SAFETY_NOTE, planSafetyNote } from "./planSafetyNote";

describe("planSafetyNote", () => {
  it.each([
    "left knee, ACL repair 2023",
    "type 2 diabetes",
    "  lower back  ",
    "high blood pressure",
    "no cartilage left in my right knee",
    "none, except asthma",
  ])("adds the note when the profile lists something: %s", (injuries) => {
    expect(planSafetyNote({ injuries })).toBe(PLAN_SAFETY_NOTE);
  });

  it.each([
    null,
    "",
    "   ",
    "none",
    "None.",
    "no",
    "n/a",
    "N/A",
    "nothing",
    "-",
    "no injuries",
    "none currently",
    "nil",
    "None!",
    "na",
    "no injuries or conditions",
    "nothing to report",
  ])("adds nothing when the profile lists nothing: %s", (injuries) => {
    expect(planSafetyNote({ injuries })).toBeNull();
  });

  it("is one line that points to a professional and repeats no health details", () => {
    expect(PLAN_SAFETY_NOTE).not.toContain("\n");
    expect(PLAN_SAFETY_NOTE).toMatch(/doctor|physiotherapist/);
    expect(planSafetyNote({ injuries: "type 2 diabetes" })).not.toMatch(
      /diabetes/i,
    );
  });
});
