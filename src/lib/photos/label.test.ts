import { describe, expect, it } from "vitest";
import { photoAlt, photoCaption, photoDate } from "./label";

const takenAt = new Date("2026-11-12T17:00:00Z");

// The labels are built from numeric date parts, so the server and the
// browser print the same text whatever their ICU data (no hydration mismatch).
describe("photoDate", () => {
  it("prints the Toronto day the same way everywhere", () => {
    expect(photoDate(takenAt)).toBe("Nov 12, 2026");
  });

  it("uses the Toronto date, not the UTC one", () => {
    // 02:00 UTC on 13 Nov is still 12 Nov in Toronto.
    expect(photoDate(new Date("2026-11-13T02:00:00Z"))).toBe("Nov 12, 2026");
  });
});

describe("photoAlt", () => {
  it("names the date and the weight when one was logged", () => {
    expect(photoAlt({ takenAt, weightKg: 81.5 })).toBe(
      "Progress photo from Nov 12, 2026, 81.5 kg",
    );
  });

  it("names only the date when no weight was logged", () => {
    expect(photoAlt({ takenAt, weightKg: null })).toBe(
      "Progress photo from Nov 12, 2026",
    );
  });
});

describe("photoCaption", () => {
  it("joins the date and weight with a dot", () => {
    expect(photoCaption({ takenAt, weightKg: 80 })).toBe(
      "Nov 12, 2026 · 80 kg",
    );
  });

  it("is just the date without a weight", () => {
    expect(photoCaption({ takenAt, weightKg: null })).toBe("Nov 12, 2026");
  });
});
