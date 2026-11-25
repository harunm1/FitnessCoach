import { describe, expect, it } from "vitest";
import {
  exportContentType,
  exportFileName,
  exportKey,
  photoFileName,
} from "./names";

const LATE_EVENING = new Date("2026-11-25T03:30:00Z"); // 24 Nov in Toronto

describe("exportFileName", () => {
  it("names a workout export by kind and Toronto day", () => {
    expect(exportFileName("WORKOUT_CSV", LATE_EVENING)).toBe(
      "fitnesscoach-workouts-2026-11-24.csv",
    );
  });

  it("names a coach export", () => {
    expect(exportFileName("COACH_CSV", LATE_EVENING)).toBe(
      "fitnesscoach-coach-chat-2026-11-24.csv",
    );
  });

  it("names a monthly report as a PDF", () => {
    expect(exportFileName("MONTHLY_REPORT", LATE_EVENING)).toBe(
      "fitnesscoach-monthly-report-2026-11-24.pdf",
    );
  });
});

describe("exportContentType", () => {
  it("says what the bytes are", () => {
    expect(exportContentType("WORKOUT_CSV")).toBe("text/csv; charset=utf-8");
    expect(exportContentType("COACH_CSV")).toBe("text/csv; charset=utf-8");
    expect(exportContentType("MONTHLY_REPORT")).toBe("application/pdf");
  });
});

describe("exportKey", () => {
  it("keeps the file in the user's own folder under a random name", () => {
    expect(exportKey("user-1", "WORKOUT_CSV", "abc-123")).toBe(
      "exports/user-1/abc-123.csv",
    );
    expect(exportKey("user-1", "MONTHLY_REPORT", "abc-123")).toBe(
      "exports/user-1/abc-123.pdf",
    );
  });
});

describe("photoFileName", () => {
  it("names a progress photo by the day it was taken", () => {
    expect(photoFileName(LATE_EVENING)).toBe("progress-photo-2026-11-24.webp");
  });
});
