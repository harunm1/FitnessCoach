// The user's programs as folders (D38): each holds its day routines with their weekdays
// and, for a program built from a template, its deload week.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProgramFolders, { type FolderPlan } from "./ProgramFolders";

const plans: FolderPlan[] = [
  {
    id: 2,
    name: "Full body, 3 days (beginner)",
    active: true,
    templateId: "full-body-3-beginner",
    days: [
      {
        name: "Full body A",
        weekdays: ["TUE"],
        exercises: [
          { name: "Barbell Squat", sets: 3, reps: 8 },
          { name: "Barbell Bench Press", sets: 3, reps: 8 },
        ],
      },
    ],
  },
  {
    id: 1,
    name: "3-day starter plan",
    active: false,
    templateId: null,
    days: [
      {
        name: "Push",
        weekdays: [],
        exercises: [{ name: "Pushups", sets: 3, reps: 10 }],
      },
    ],
  },
];

describe("ProgramFolders", () => {
  const html = renderToStaticMarkup(<ProgramFolders plans={plans} />);

  it("shows one folder per program, the active one marked and open", () => {
    expect(html.split("<details").length - 1).toBe(3); // two folders, one deload
    expect(html).toContain("Full body, 3 days (beginner)");
    expect(html).toContain("Active");
    expect(html).toMatch(
      /<details open=""[^>]*>\s*<summary[^>]*>[^<]*Full body, 3 days/,
    );
  });

  it("lists each day routine with its weekdays and exercises", () => {
    expect(html).toContain("Full body A");
    expect(html).toContain("Tuesday");
    expect(html).toContain("Barbell Squat: 3 x 8");
  });

  it("holds a deload week with the same exercises, half the sets and a lighter load", () => {
    expect(html).toContain("Deload week, every 8 weeks");
    expect(html).toContain("Barbell Squat: 2 x 8");
    expect(html).toContain("about 60% of your usual weight");
  });

  it("gives an older plan without a template no deload folder", () => {
    const older = renderToStaticMarkup(<ProgramFolders plans={[plans[1]]} />);
    expect(older).not.toContain("Deload week");
    expect(older).toContain("Pushups: 3 x 10");
  });

  it("says so when there are no programs yet", () => {
    expect(renderToStaticMarkup(<ProgramFolders plans={[]} />)).toContain(
      "No programs yet",
    );
  });
});
