import { describe, expect, it } from "vitest";
import { facingFor, kindLabel, readPhotoKind } from "./kind";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe("readPhotoKind", () => {
  it("is a progress photo with no exercise when nothing is sent", () => {
    expect(readPhotoKind(form({}))).toEqual({
      ok: true,
      kind: "PROGRESS",
      exerciseId: undefined,
    });
  });

  it("keeps the exercise of a form photo", () => {
    expect(
      readPhotoKind(form({ kind: "FORM", exerciseId: "Barbell_Squat" })),
    ).toEqual({ ok: true, kind: "FORM", exerciseId: "Barbell_Squat" });
  });

  it("lets a form photo have no exercise", () => {
    expect(readPhotoKind(form({ kind: "FORM", exerciseId: " " }))).toEqual({
      ok: true,
      kind: "FORM",
      exerciseId: undefined,
    });
  });

  it("drops an exercise sent with a progress photo", () => {
    expect(
      readPhotoKind(form({ kind: "PROGRESS", exerciseId: "Barbell_Squat" })),
    ).toEqual({ ok: true, kind: "PROGRESS", exerciseId: undefined });
  });

  it("treats a blank kind as not sent", () => {
    expect(readPhotoKind(form({ kind: "" }))).toMatchObject({
      ok: true,
      kind: "PROGRESS",
    });
  });

  it.each(["progress", "SELFIE", "FORM,PROGRESS"])(
    "refuses the unknown kind %j",
    (kind) => {
      expect(readPhotoKind(form({ kind }))).toEqual({
        ok: false,
        message: "Choose progress photo or form photo.",
      });
    },
  );

  it("refuses an exercise id that is too long to be real", () => {
    expect(
      readPhotoKind(form({ kind: "FORM", exerciseId: "x".repeat(201) })),
    ).toEqual({ ok: false, message: "That exercise couldn't be found." });
  });
});

describe("facingFor", () => {
  it("uses the back camera for progress photos and the front for form selfies", () => {
    expect(facingFor("PROGRESS")).toBe("environment");
    expect(facingFor("FORM")).toBe("user");
  });
});

describe("kindLabel", () => {
  it("adds nothing for a progress photo", () => {
    expect(kindLabel("PROGRESS", null)).toBeNull();
  });

  it("names a form photo and its exercise", () => {
    expect(kindLabel("FORM", "Barbell Squat")).toBe(
      "Form photo · Barbell Squat",
    );
    expect(kindLabel("FORM", null)).toBe("Form photo");
  });
});
