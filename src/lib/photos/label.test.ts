import { describe, expect, it } from "vitest";
import { photoAlt, photoCaption } from "./label";

// ICU versions differ on "Nov." vs "Nov", so the month is matched either way.
const DATE = String.raw`Nov\.? 12, 2026`;
const exactly = (text: string) => new RegExp(`^${text}$`);

const takenAt = new Date("2026-11-12T17:00:00Z");

describe("photoAlt", () => {
  it("names the date and the weight when one was logged", () => {
    expect(photoAlt({ takenAt, weightKg: 81.5 })).toMatch(
      exactly(`Progress photo from ${DATE}, 81[.]5 kg`),
    );
  });

  it("names only the date when no weight was logged", () => {
    expect(photoAlt({ takenAt, weightKg: null })).toMatch(
      exactly(`Progress photo from ${DATE}`),
    );
  });

  it("uses the Toronto date, not the UTC one", () => {
    // 02:00 UTC on 13 Nov is still 12 Nov in Toronto.
    const lateEvening = new Date("2026-11-13T02:00:00Z");
    expect(photoAlt({ takenAt: lateEvening, weightKg: null })).toMatch(
      exactly(`Progress photo from ${DATE}`),
    );
  });
});

describe("photoCaption", () => {
  it("joins the date and weight with a dot", () => {
    expect(photoCaption({ takenAt, weightKg: 80 })).toMatch(
      exactly(`${DATE} · 80 kg`),
    );
  });

  it("is just the date without a weight", () => {
    expect(photoCaption({ takenAt, weightKg: null })).toMatch(exactly(DATE));
  });
});
