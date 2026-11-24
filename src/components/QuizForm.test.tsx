// Tests for the quiz form (#138, #143): it shows the saved answers, Bodyweight is exclusive, and the split is stated.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/onboarding/actions", () => ({ saveQuizProfile: vi.fn() }));
import QuizForm from "./QuizForm";
import type { QuizAnswers } from "@/lib/onboarding/answers";

const saved: QuizAnswers = {
  goal: "FAT_LOSS",
  level: "EXPERT",
  trainingMode: "BOTH",
  daysPerWeek: 3,
  equipment: ["barbell", "cable"],
  injuries: "left knee",
};

// The <input> tag for a value, e.g. value="FAT_LOSS".
function tagFor(html: string, value: string) {
  return html.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`))?.[0] ?? "";
}

describe("QuizForm", () => {
  it("shows the saved answers, not the defaults", () => {
    const html = renderToStaticMarkup(<QuizForm initial={saved} />);
    expect(tagFor(html, "FAT_LOSS")).toContain("checked");
    expect(tagFor(html, "STRENGTH")).not.toContain("checked");
    expect(tagFor(html, "BOTH")).toContain("checked");
    expect(tagFor(html, "barbell")).toContain("checked");
    expect(tagFor(html, "cable")).toContain("checked");
    expect(tagFor(html, "body only")).not.toContain("checked");
    expect(html).toContain('<option value="EXPERT" selected');
    expect(html).toContain("left knee");
  });

  it("starts a new user on Bodyweight with no experience chosen", () => {
    const html = renderToStaticMarkup(<QuizForm />);
    expect(tagFor(html, "body only")).toContain("checked");
    expect(tagFor(html, "barbell")).not.toContain("checked");
    expect(html).not.toMatch(
      /<option value="(BEGINNER|INTERMEDIATE|EXPERT)" selected/,
    );
  });

  it("calls the equipment item Bodyweight", () => {
    const html = renderToStaticMarkup(<QuizForm />);
    expect(html).toContain("Bodyweight");
    expect(html).not.toContain("Bodyweight only");
  });

  it("states how the days are split before saving", () => {
    const html = renderToStaticMarkup(<QuizForm initial={saved} />);
    expect(html).toContain(
      "3 days a week will be 2 strength days and 1 run day",
    );
  });
});
