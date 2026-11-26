// The nested create input for a program built from a template (D38).
import { describe, expect, it } from "vitest";
import { getTemplate } from "./templates";
import { templateToPlan } from "./guardrails";
import { programToPlanData } from "./save";

const template = getTemplate("full-body-3-beginner")!;

describe("programToPlanData", () => {
  it("records the template, its version, the source and each day's weekdays", () => {
    const plan = templateToPlan(template);
    const data = programToPlanData("user-1", template, plan, [
      ["TUE"],
      ["THU"],
      ["SAT"],
    ]);
    expect(data).toMatchObject({
      userId: "user-1",
      name: template.name,
      source: "TEMPLATE",
      active: true,
      templateId: template.id,
      templateVersion: template.version,
    });
    const days = (data.days as { create: unknown[] }).create as Array<{
      dayIndex: number;
      name: string;
      kind: string;
      weekdays: string[];
      exercises: {
        create: Array<{ exerciseId: string; order: number; sets: number }>;
      };
    }>;
    expect(days.map((d) => [d.dayIndex, d.name, d.kind, d.weekdays])).toEqual([
      [0, "Full body A", "STRENGTH", ["TUE"]],
      [1, "Full body B", "STRENGTH", ["THU"]],
      [2, "Full body C", "STRENGTH", ["SAT"]],
    ]);
    expect(days[0].exercises.create[0]).toMatchObject({
      exerciseId: "Barbell_Squat",
      order: 0,
      sets: 3,
    });
  });

  it("uses the template's suggested weekdays when none are given", () => {
    const data = programToPlanData(
      "user-1",
      template,
      templateToPlan(template),
    );
    const days = (data.days as { create: Array<{ weekdays: string[] }> })
      .create;
    expect(days.map((d) => d.weekdays)).toEqual([["MON"], ["WED"], ["FRI"]]);
  });
});
