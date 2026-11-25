import { describe, expect, it } from "vitest";
import { MAX_PAGE, parseExerciseId, parsePage, parseWorkoutId } from "./params";

describe("parsePage", () => {
  it("reads a page number from the link", () => {
    expect(parsePage("1")).toBe(1);
    expect(parsePage("3")).toBe(3);
  });

  it("falls back to the first page for anything else", () => {
    for (const value of [undefined, "", "0", "-2", "2.5", "abc", "3x", " 2"]) {
      expect(parsePage(value)).toBe(1);
    }
  });

  it("caps the page so a long link cannot ask for a huge offset", () => {
    expect(parsePage(String(MAX_PAGE))).toBe(MAX_PAGE);
    expect(parsePage(String(MAX_PAGE + 1))).toBe(MAX_PAGE);
    expect(parsePage("99999999999999999999")).toBe(MAX_PAGE);
  });
});

describe("parseWorkoutId", () => {
  it("reads a positive whole number", () => {
    expect(parseWorkoutId("41")).toBe(41);
  });

  it("refuses anything that is not a workout id", () => {
    for (const value of ["", "0", "-1", "1.5", "41abc", "abc", "1e3", " 4"]) {
      expect(parseWorkoutId(value)).toBeNull();
    }
  });

  it("refuses ids past the Int column, which Prisma would throw on", () => {
    expect(parseWorkoutId("2147483647")).toBe(2147483647);
    expect(parseWorkoutId("2147483648")).toBeNull();
  });
});

describe("parseExerciseId", () => {
  it("keeps a free-exercise-db slug as it is", () => {
    expect(parseExerciseId("Barbell_Bench_Press_-_Medium_Grip")).toBe(
      "Barbell_Bench_Press_-_Medium_Grip",
    );
  });

  it("refuses an empty or overlong id", () => {
    expect(parseExerciseId("")).toBeNull();
    expect(parseExerciseId("a".repeat(201))).toBeNull();
    expect(parseExerciseId("a".repeat(200))).toBe("a".repeat(200));
  });
});
