// Program templates against a real PostgreSQL (D38): the adapt action returns the
// coach's changes or the template with a note; the save action re-checks the accepted
// changes on the server, saves a TEMPLATE plan with weekdays, and saves nothing when a
// guardrail fails.
import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { requireUser, model } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  model: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});
vi.mock("@/lib/coach/providers", async (original) => ({
  ...(await original<typeof import("@/lib/coach/providers")>()),
  coachModel: () => model,
}));

import { adaptProgram, saveProgram } from "@/app/programs/actions";
import { FALLBACK_NOTE } from "@/lib/programs/adapt";
import { loadProgramFolders } from "@/lib/programs/folders";
import { prisma as db } from "@/lib/prisma";
import { readFileSync } from "node:fs";

const prefix = `programs-${randomUUID()}`;
let sequence = 0;
const TEMPLATE_ID = "full-body-3-beginner";

// The exercises the template and the tests name, from the free-exercise-db copy.
beforeAll(async () => {
  const library = JSON.parse(
    readFileSync("eval/fixtures-library.json", "utf8"),
  ) as Array<{
    id: string;
    name: string;
    category: string;
    equipment: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  }>;
  await db.exercise.createMany({
    data: library.map((e) => ({
      id: e.id,
      name: e.name,
      level: "BEGINNER" as const,
      equipment: e.equipment,
      category: e.category,
      primaryMuscles: e.primaryMuscles,
      secondaryMuscles: e.secondaryMuscles,
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    })),
    skipDuplicates: true,
  });
});

async function athlete(equipment = ["barbell", "dumbbell"]) {
  const user = await db.user.create({
    data: {
      name: "Program athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
      profile: {
        create: {
          goal: "STRENGTH",
          level: "BEGINNER",
          daysPerWeek: 3,
          equipment,
        },
      },
    },
  });
  requireUser.mockResolvedValue({ id: user.id });
  return user;
}

beforeEach(() => {
  model.mockReset();
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.$disconnect();
});

const coachReply = {
  changes: [
    {
      op: "swap",
      day: 1,
      slot: 1,
      exercise: "Dumbbell Squat",
      reason: "Easier to learn than the barbell squat",
    },
    { op: "reps", day: 2, slot: 1, reps: 10, reason: "A little more volume" },
  ],
};

describe("adaptProgram", () => {
  it("returns the coach's changes with a reason each", async () => {
    await athlete();
    model.mockResolvedValue(coachReply);
    const result = await adaptProgram(TEMPLATE_ID);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.adaptation.source).toBe("COACH");
    expect(result.adaptation.changes.map((c) => c.reason)).toEqual([
      "Easier to learn than the barbell squat",
      "A little more volume",
    ]);
  });

  it("returns the template at once with a plain note when the model fails", async () => {
    await athlete();
    model.mockRejectedValue(new Error("provider down"));
    const result = await adaptProgram(TEMPLATE_ID);
    expect(result).toMatchObject({
      status: "ok",
      adaptation: { source: "TEMPLATE", note: FALLBACK_NOTE, changes: [] },
    });
  });

  it("refuses an unknown template", async () => {
    await athlete();
    expect(await adaptProgram("no-such-template")).toMatchObject({
      status: "error",
    });
    expect(model).not.toHaveBeenCalled();
  });
});

describe("saveProgram", () => {
  it("saves the template with the accepted changes and weekdays as the active plan", async () => {
    const user = await athlete();
    model.mockResolvedValue(coachReply);
    const adapted = await adaptProgram(TEMPLATE_ID);
    if (adapted.status !== "ok") throw new Error("adapt failed");
    const [swap, reps] = adapted.adaptation.changes;

    const saved = await saveProgram({
      templateId: TEMPLATE_ID,
      changes: adapted.adaptation.changes,
      accepted: [reps.id], // the swap is reverted
      weekdays: [["MON"], ["THU"], ["SAT"]],
    });
    expect(saved).toMatchObject({ status: "ok" });

    const plan = await db.plan.findFirstOrThrow({
      where: { userId: user.id, active: true },
      include: {
        days: { include: { exercises: true }, orderBy: { dayIndex: "asc" } },
      },
    });
    expect(plan).toMatchObject({
      source: "TEMPLATE",
      templateId: TEMPLATE_ID,
      templateVersion: 1,
    });
    expect(plan.days.map((d) => d.weekdays)).toEqual([
      ["MON"],
      ["THU"],
      ["SAT"],
    ]);
    const day0 = plan.days[0].exercises.sort((a, b) => a.order - b.order);
    expect(day0[0].exerciseId).toBe("Barbell_Squat"); // swap reverted
    expect(swap.op).toBe("swap");
    const day1 = plan.days[1].exercises.sort((a, b) => a.order - b.order);
    expect(day1[0].reps).toBe(10); // reps change kept
  });

  it("saves nothing when the accepted changes break a guardrail", async () => {
    const user = await athlete();
    const saved = await saveProgram({
      templateId: TEMPLATE_ID,
      changes: [
        {
          id: "coach-1",
          source: "coach",
          op: "swap",
          day: 0,
          slot: 0,
          exerciseId: "Leg_Press",
          reason: "x",
        },
      ],
      accepted: ["coach-1"],
      weekdays: [["MON"], ["WED"], ["FRI"]],
    });
    expect(saved).toMatchObject({ status: "error" });
    if (saved.status === "error")
      expect(saved.message).toMatch(/needs machine/);
    expect(await db.plan.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses the same weekday on two days", async () => {
    const user = await athlete();
    const saved = await saveProgram({
      templateId: TEMPLATE_ID,
      changes: [],
      accepted: [],
      weekdays: [["MON"], ["MON"], ["FRI"]],
    });
    expect(saved).toMatchObject({ status: "error" });
    expect(await db.plan.count({ where: { userId: user.id } })).toBe(0);
  });

  it("replaces the previous active plan", async () => {
    const user = await athlete();
    const input = {
      templateId: TEMPLATE_ID,
      changes: [],
      accepted: [],
      weekdays: [["MON"], ["WED"], ["FRI"]] as const,
    };
    await saveProgram({
      ...input,
      weekdays: input.weekdays.map((w) => [...w]),
    });
    await saveProgram({
      ...input,
      weekdays: input.weekdays.map((w) => [...w]),
    });
    expect(await db.plan.count({ where: { userId: user.id } })).toBe(2);
    expect(
      await db.plan.count({ where: { userId: user.id, active: true } }),
    ).toBe(1);
  });
});

describe("loadProgramFolders", () => {
  it("lists only the user's own programs, newest first, with weekdays and exercise names", async () => {
    const other = await athlete();
    await saveProgram({
      templateId: TEMPLATE_ID,
      changes: [],
      accepted: [],
      weekdays: [["MON"], ["WED"], ["FRI"]],
    });
    const user = await athlete();
    await saveProgram({
      templateId: TEMPLATE_ID,
      changes: [],
      accepted: [],
      weekdays: [["TUE"], ["THU"], ["SAT"]],
    });

    const folders = await loadProgramFolders(user.id);
    expect(folders.length).toBeGreaterThanOrEqual(1);
    expect(folders[0]).toMatchObject({ active: true, templateId: TEMPLATE_ID });
    expect(folders[0].days[0]).toMatchObject({
      name: "Full body A",
      weekdays: ["TUE"],
    });
    expect(folders[0].days[0].exercises[0]).toEqual({
      name: "Barbell Squat",
      sets: 3,
      reps: 8,
    });
    const otherIds = (
      await db.plan.findMany({
        where: { userId: other.id },
        select: { id: true },
      })
    ).map((p) => p.id);
    expect(folders.map((f) => f.id).some((id) => otherIds.includes(id))).toBe(
      false,
    );
  });
});
