// Tests for the import server action (#131): signed-in only, size and type checks, a preview
// that lists unmatched names, and a save that is owned by the user and ignores forged ids.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, database } = vi.hoisted(() => {
  const database = {
    exercise: { findMany: vi.fn() },
    workout: { findMany: vi.fn(), createManyAndReturn: vi.fn() },
    setLog: { createMany: vi.fn() },
    $transaction: vi.fn(),
  };
  database.$transaction.mockImplementation(
    async (run: (tx: typeof database) => unknown) => run(database),
  );
  return { requireUser: vi.fn(), revalidatePath: vi.fn(), database };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { importWorkouts } from "./actions";

const fixture = readFileSync("tests/fixtures/hevy-export.csv", "utf8");
const idle = { status: "idle" as const };
const LINE_FEED = 10;
const NEWLINE = String.fromCharCode(LINE_FEED);
const library = [
  { id: "bench", name: "Barbell Bench Press - Medium Grip" },
  { id: "facepull", name: "Face Pull" },
  { id: "pullups", name: "Pullups" },
  { id: "carry", name: "Farmers Walk" },
];

function form(fields: Record<string, string | Blob>) {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.append(name, value));
  return data;
}
const csvFile = (text = fixture, name = "hevy.csv") =>
  new File([text], name, { type: "text/csv" });

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user-1" });
  database.exercise.findMany.mockResolvedValue(library);
  database.workout.findMany.mockResolvedValue([]);
  database.workout.createManyAndReturn.mockImplementation(
    async ({ data }: { data: { importKey: string }[] }) =>
      data.map((row, index) => ({ id: index + 1, importKey: row.importKey })),
  );
  database.setLog.createMany.mockResolvedValue({ count: 0 });
});

describe("importWorkouts", () => {
  it("requires a signed-in user before anything else", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      importWorkouts(idle, form({ intent: "preview", file: csvFile() })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(database.exercise.findMany).not.toHaveBeenCalled();
  });

  it("previews: counts, the unmatched names and the library to map them to", async () => {
    const state = await importWorkouts(
      idle,
      form({ intent: "preview", file: csvFile() }),
    );
    if (state.status !== "preview") throw new Error(JSON.stringify(state));
    expect(state.summary).toMatchObject({
      workouts: 2,
      newWorkouts: 2,
      sets: 5,
      skippedWarmups: 1,
    });
    expect(state.unmatched).toEqual(["Zercher Carry"]);
    expect(state.library).toEqual(library);
    expect(database.workout.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("previews how many workouts are already imported", async () => {
    database.workout.findMany.mockResolvedValue([
      {
        importKey: "2024-06-20T22:30:00.000Z|Push Day",
        sets: [{ exerciseId: "bench" }, { exerciseId: "facepull" }],
      },
    ]);
    const state = await importWorkouts(
      idle,
      form({ intent: "preview", file: csvFile() }),
    );
    if (state.status !== "preview") throw new Error(JSON.stringify(state));
    expect(state.summary.newWorkouts).toBe(1);
    expect(state.summary.repairableWorkouts).toBe(0);
  });

  // Live bug L4: a stored workout that lacks an exercise the file has (and we can match) is
  // counted, so the page offers the import again instead of disabling the button.
  it("previews how many already-imported workouts are missing exercises", async () => {
    database.workout.findMany.mockResolvedValue([
      {
        importKey: "2024-06-20T22:30:00.000Z|Push Day",
        sets: [{ exerciseId: "bench" }],
      },
    ]);
    const state = await importWorkouts(
      idle,
      form({ intent: "preview", file: csvFile() }),
    );
    if (state.status !== "preview") throw new Error(JSON.stringify(state));
    expect(state.summary.repairableWorkouts).toBe(1);
  });

  it("bounds the already-imported lookup to the user's own rows and the file's workout count (#76)", async () => {
    const state = await importWorkouts(
      idle,
      form({ intent: "preview", file: csvFile() }),
    );
    if (state.status !== "preview") throw new Error(JSON.stringify(state));
    const query = database.workout.findMany.mock.calls[0][0];
    expect(query.take).toBe(state.summary.workouts);
    expect(query.where.userId).toBe("user-1");
    expect(query.select).toEqual({
      importKey: true,
      sets: { select: { exerciseId: true } },
    });
  });

  it("refuses a missing file, a non-CSV name and an oversize file", async () => {
    const none = await importWorkouts(idle, form({ intent: "preview" }));
    const wrongName = await importWorkouts(
      idle,
      form({ intent: "preview", file: csvFile(fixture, "hevy.xlsx") }),
    );
    const big = new File([new Uint8Array(2_000_001)], "big.csv");
    const tooBig = await importWorkouts(
      idle,
      form({ intent: "preview", file: big }),
    );
    [none, wrongName, tooBig].forEach((state) =>
      expect(state.status).toBe("error"),
    );
    expect(database.exercise.findMany).not.toHaveBeenCalled();
  });

  it("shows the parser's message for a file that is not a Hevy export", async () => {
    const state = await importWorkouts(
      idle,
      form({ intent: "preview", file: csvFile("a,b\n1,2\n") }),
    );
    expect(state).toMatchObject({ status: "error" });
    if (state.status === "error")
      expect(state.message).toMatch(/Missing columns/);
  });

  it("saves matched exercises and the ones the user mapped, for this user", async () => {
    const state = await importWorkouts(
      idle,
      form({
        intent: "save",
        file: csvFile(),
        title_0: "Zercher Carry",
        map_0: "carry",
      }),
    );
    expect(state).toMatchObject({
      status: "saved",
      result: { imported: 2, sets: 5 },
    });
    const saved = database.workout.createManyAndReturn.mock.calls[0][0].data;
    expect(
      saved.every((row: { userId: string }) => row.userId === "user-1"),
    ).toBe(true);
    expect(
      saved.every((row: { source: string }) => row.source === "hevy-import"),
    ).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/progress");
  });

  it("reports what the save left out: warm-ups, timed sets and the names it could not match", async () => {
    const csv = [
      "title,start_time,end_time,exercise_title,set_type,weight_kg,reps,duration_seconds",
      '"A","20 Jun 2024, 18:30","20 Jun 2024, 19:00","Face Pull (Cable)","warmup","10","15",""',
      '"A","20 Jun 2024, 18:30","20 Jun 2024, 19:00","Face Pull (Cable)","normal","25","15",""',
      '"A","20 Jun 2024, 18:30","20 Jun 2024, 19:00","Zercher Carry","normal","60","12",""',
      '"A","20 Jun 2024, 18:30","20 Jun 2024, 19:00","Plank","normal","","","60"',
    ].join(NEWLINE);
    const state = await importWorkouts(
      idle,
      form({ intent: "save", file: csvFile(csv + NEWLINE) }),
    );
    expect(state).toMatchObject({
      status: "saved",
      report: {
        skippedWarmups: 1,
        skippedTimedSets: 1,
        skippedNames: ["Zercher Carry"],
        moreSkippedNames: 0,
      },
    });
  });

  it("skips a name left unmapped, and ignores an id that is not in the library", async () => {
    const state = await importWorkouts(
      idle,
      form({
        intent: "save",
        file: csvFile(),
        title_0: "Zercher Carry",
        map_0: "not-a-real-id",
      }),
    );
    expect(state).toMatchObject({
      status: "saved",
      result: { sets: 4, skippedSets: 1 },
    });
  });

  it("lets a forged form field change neither a matched title nor another user's data", async () => {
    // title_0 names a title the code matched itself; map_0 points at another exercise.
    await importWorkouts(
      idle,
      form({
        intent: "save",
        file: csvFile(),
        title_0: "Bench Press (Barbell)",
        map_0: "carry",
      }),
    );
    const sets = database.setLog.createMany.mock.calls[0][0].data;
    const bench = sets.filter(
      (row: { exerciseId: string }) => row.exerciseId === "bench",
    );
    expect(bench).toHaveLength(2);
  });

  it("gives the save transaction time for a large file", async () => {
    await importWorkouts(idle, form({ intent: "save", file: csvFile() }));
    expect(database.$transaction.mock.calls[0][1]).toEqual({ timeout: 30_000 });
  });

  it("says how many unmatched names are not shown", async () => {
    const names = Array.from({ length: 35 }, (_, i) => `Odd Lift ${i}`);
    const rows = names
      .map(
        (n) =>
          `"A","20 Jun 2024, 18:30","20 Jun 2024, 19:00","${n}","normal","50","5"`,
      )
      .join("\n");
    const csv = `title,start_time,end_time,exercise_title,set_type,weight_kg,reps\n${rows}\n`;
    const state = await importWorkouts(
      idle,
      form({ intent: "preview", file: csvFile(csv) }),
    );
    if (state.status !== "preview") throw new Error(JSON.stringify(state));
    expect(state.unmatched).toHaveLength(30);
    expect(state.moreUnmatched).toBe(5);
  });

  it("ignores a mapping for a title that is not in the file", async () => {
    await importWorkouts(
      idle,
      form({
        intent: "save",
        file: csvFile(),
        title_0: "Made Up",
        map_0: "carry",
      }),
    );
    const sets = database.setLog.createMany.mock.calls[0][0].data;
    expect(
      sets.some((row: { exerciseId: string }) => row.exerciseId === "carry"),
    ).toBe(false);
  });

  it("says so when everything was imported before", async () => {
    database.workout.createManyAndReturn.mockResolvedValue([]);
    const state = await importWorkouts(
      idle,
      form({ intent: "save", file: csvFile() }),
    );
    expect(state).toMatchObject({
      status: "saved",
      result: { imported: 0, alreadyImported: 2 },
    });
  });

  it("reports a failed save without leaking the cause", async () => {
    database.workout.createManyAndReturn.mockRejectedValue(
      new Error("secret db text"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await importWorkouts(
      idle,
      form({ intent: "save", file: csvFile() }),
    );
    expect(state).toMatchObject({ status: "error" });
    if (state.status === "error") expect(state.message).not.toMatch(/secret/);
  });
});
