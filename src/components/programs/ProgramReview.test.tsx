// @vitest-environment jsdom
// The review of an adapted template (D38): each change shows its reason and can be kept,
// edited or reverted; days can move to other weekdays; Save sends exactly that.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/programs/actions", () => ({ saveProgram: save }));

import { getTemplate } from "@/lib/programs/templates";
import type { Adaptation } from "@/lib/programs/adapt";
import ProgramReview from "./ProgramReview";

const template = getTemplate("full-body-3-beginner")!;
const names: Record<string, string> = {
  Barbell_Squat: "Barbell Squat",
  Dumbbell_Squat: "Dumbbell Squat",
  "Barbell_Bench_Press_-_Medium_Grip": "Barbell Bench Press",
  Romanian_Deadlift: "Romanian Deadlift",
};

const adaptation: Adaptation = {
  templateId: template.id,
  templateVersion: template.version,
  source: "COACH",
  problems: [],
  changes: [
    {
      id: "coach-1",
      source: "coach",
      op: "swap",
      day: 0,
      slot: 0,
      exerciseId: "Dumbbell_Squat",
      reason: "Easier to learn than the barbell squat",
    },
    {
      id: "coach-2",
      source: "coach",
      op: "reps",
      day: 1,
      slot: 0,
      reps: 10,
      reason: "A little more volume",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue({ status: "ok", planId: 7 });
});
afterEach(cleanup);

const dayA = () => screen.getByRole("region", { name: "Full body A" });

describe("ProgramReview", () => {
  it("shows each change with its reason, kept by default, in the day's exercises", () => {
    render(
      <ProgramReview
        template={template}
        adaptation={adaptation}
        names={names}
      />,
    );
    expect(
      screen.getByText("Easier to learn than the barbell squat"),
    ).toBeTruthy();
    expect(screen.getByText("A little more volume")).toBeTruthy();
    const keeps = screen.getAllByRole("checkbox", {
      name: /keep this change/i,
    });
    expect(keeps.map((k) => (k as HTMLInputElement).checked)).toEqual([
      true,
      true,
    ]);
    expect(within(dayA()).getByText(/Dumbbell Squat: 3 x 8/)).toBeTruthy();
  });

  it("reverts one change in the preview and keeps the other", () => {
    render(
      <ProgramReview
        template={template}
        adaptation={adaptation}
        names={names}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("checkbox", { name: /keep this change/i })[0],
    );
    expect(within(dayA()).getByText(/Barbell Squat: 3 x 8/)).toBeTruthy();
    expect(within(dayA()).queryByText(/Dumbbell Squat/)).toBeNull();
    const dayB = screen.getByRole("region", { name: "Full body B" });
    expect(within(dayB).getByText(/Romanian Deadlift: 3 x 10/)).toBeTruthy();
  });

  it("saves the kept changes, an edited value and the moved weekdays", async () => {
    render(
      <ProgramReview
        template={template}
        adaptation={adaptation}
        names={names}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("checkbox", { name: /keep this change/i })[0],
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /reps for change 2/i }),
      {
        target: { value: "12" },
      },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Weekday for Full body A" }),
      {
        target: { value: "TUE" },
      },
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save program" }));
    });
    expect(save).toHaveBeenCalledWith({
      templateId: template.id,
      changes: [adaptation.changes[0], { ...adaptation.changes[1], reps: 12 }],
      accepted: ["coach-2"],
      weekdays: [["TUE"], ["WED"], ["FRI"]],
    });
    expect(screen.getByRole("status").textContent).toMatch(/saved/i);
  });

  it("shows the plain note when the coach could not adapt the template", () => {
    render(
      <ProgramReview
        template={template}
        adaptation={{
          ...adaptation,
          source: "TEMPLATE",
          changes: [],
          note: "The coach could not adapt this template just now.",
        }}
        names={names}
      />,
    );
    expect(
      screen.getByText(/could not adapt this template just now/),
    ).toBeTruthy();
    expect(screen.getByText(/no changes/i)).toBeTruthy();
  });

  it("shows why a save was refused", async () => {
    save.mockResolvedValue({
      status: "error",
      message: "This program cannot be saved yet: x.",
    });
    render(
      <ProgramReview
        template={template}
        adaptation={adaptation}
        names={names}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save program" }));
    });
    expect(screen.getByRole("alert").textContent).toMatch(
      /cannot be saved yet/,
    );
  });
});
