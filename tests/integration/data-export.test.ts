// Integration test for the data exports (D33) against a real PostgreSQL: an export holds only
// the owner's rows, the table keeps only the newest ones, and one user can never download
// another user's export or photo (the route answers 404 for it).
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
import { MemoryStorage } from "@/lib/storage/memory";

const { session, storage } = vi.hoisted(() => ({
  session: { userId: "" },
  storage: { current: undefined as unknown },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});
vi.mock("@/lib/auth/session", () => ({
  getVerifiedUser: async () => ({ id: session.userId }),
}));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: () => storage.current }));

import { GET as downloadExport } from "@/app/api/exports/[id]/download/route";
import { GET as downloadPhoto } from "@/app/api/photos/[id]/download/route";
import { createExport } from "@/lib/exports/create";
import { EXPORTS_KEPT } from "@/lib/exports/limits";
import { prisma as db } from "@/lib/prisma";
import { loadMonthlyReportInput } from "@/lib/report/load";
import { buildMonthlyReport } from "@/lib/report/summary";

const prefix = `export-${randomUUID()}`;
const exerciseId = `${prefix}-squat`;
const NOT_FOUND = 404;
const OK = 200;
const REPS = 5;
const KG = 100;
const RPE = 8;
const EXTRA_EXPORTS = 2;
const ONE_HOUR_MS = 3_600_000;
const TWO_HOURS_MS = ONE_HOUR_MS + ONE_HOUR_MS; // moves the rate-limit window past rows made now
let sequence = 0;
let files: MemoryStorage;

beforeAll(async () => {
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: "Export Squat",
      level: "BEGINNER",
      category: "strength",
      equipment: "barbell",
      primaryMuscles: ["quadriceps"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    },
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({ where: { id: exerciseId } });
  await db.$disconnect();
});

beforeEach(() => {
  files = new MemoryStorage();
  storage.current = files;
  // The signed link is not reachable in a test, so the app sends the file itself.
  vi.stubGlobal("fetch", async () => new Response("a"));
});

async function athlete(weightUnit: "KG" | "LB" = "KG") {
  const user = await db.user.create({
    data: {
      name: "Export athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
      weightUnit,
    },
  });
  await db.workout.create({
    data: {
      userId: user.id,
      startedAt: new Date("2026-11-08T17:00:00Z"),
      notes: `notes of ${user.id}`,
      sets: {
        create: [
          { exerciseId, setNumber: 1, reps: REPS, weightKg: KG, rpe: RPE },
        ],
      },
    },
  });
  const conversation = await db.conversation.create({
    data: {
      userId: user.id,
      messages: {
        create: [{ role: "USER", content: `question of ${user.id}` }],
      },
    },
  });
  return { user, conversation };
}

const call = (route: typeof downloadExport, id: string) =>
  route(new Request("http://localhost/download"), {
    params: Promise.resolve({ id }),
  });

describe("exports on PostgreSQL", () => {
  it("writes only the owner's sets, in the owner's unit", async () => {
    const { user } = await athlete("LB");
    const other = await athlete();

    await createExport(user.id, "WORKOUT_CSV", { storage: files });

    const [[, file]] = [...files.files.entries()];
    const text = file.body.toString("utf8");
    expect(text).toContain(`Export Squat,1,220.5,lb,5,8,notes of ${user.id}`);
    expect(text).not.toContain(other.user.id);
    expect(await db.dataExport.count({ where: { userId: user.id } })).toBe(1);
  });

  it("writes only the owner's coach messages", async () => {
    const { user } = await athlete();
    const other = await athlete();

    await createExport(user.id, "COACH_CSV", { storage: files });

    const text = [...files.files.values()][0].body.toString("utf8");
    expect(text).toContain(`question of ${user.id}`);
    expect(text).not.toContain(other.user.id);
  });

  it("keeps the newest exports and removes the rest from the table and from storage", async () => {
    const { user } = await athlete();
    const later = new Date(Date.now() + TWO_HOURS_MS);
    const made = await Array.from({
      length: EXPORTS_KEPT + EXTRA_EXPORTS,
    }).reduce(async (done: Promise<string[]>) => {
      const keys = await done;
      const row = await createExport(user.id, "WORKOUT_CSV", {
        storage: files,
        now: later,
      });
      return [...keys, row.r2Key];
    }, Promise.resolve([]));

    const kept = await db.dataExport.findMany({ where: { userId: user.id } });
    expect(kept).toHaveLength(EXPORTS_KEPT);
    expect(files.files.size).toBe(EXPORTS_KEPT);
    expect(kept.map((row) => row.r2Key).sort()).toEqual(
      made.slice(-EXPORTS_KEPT).sort(),
    );
  });
});

describe("downloads on PostgreSQL (one user never reaches another's file)", () => {
  it("lets the owner download an export and answers 404 for anyone else", async () => {
    const owner = await athlete();
    const intruder = await athlete();
    const row = await createExport(owner.user.id, "WORKOUT_CSV", {
      storage: files,
    });

    session.userId = owner.user.id;
    const mine = await call(downloadExport, row.id);
    expect(mine.status).toBe(OK);
    expect(mine.headers.get("content-disposition")).toContain("attachment");

    session.userId = intruder.user.id;
    const theirs = await call(downloadExport, row.id);
    const missing = await call(downloadExport, "no-such-export");
    expect(theirs.status).toBe(NOT_FOUND);
    expect(await theirs.text()).toBe(await missing.text());
  });

  it("lets the owner download a photo and answers 404 for anyone else", async () => {
    const owner = await athlete();
    const intruder = await athlete();
    const key = `progress/${owner.user.id}/${randomUUID()}.webp`;
    await files.put(key, Buffer.from("webp"), "image/webp");
    const photo = await db.progressPhoto.create({
      data: { userId: owner.user.id, storageKey: key },
    });

    session.userId = owner.user.id;
    const mine = await call(downloadPhoto, String(photo.id));
    expect(mine.status).toBe(OK);
    expect(mine.headers.get("content-disposition")).toContain(
      "progress-photo-",
    );

    session.userId = intruder.user.id;
    expect((await call(downloadPhoto, String(photo.id))).status).toBe(
      NOT_FOUND,
    );
  });
});

describe("monthly report on PostgreSQL", () => {
  const MONTH = "2026-11";
  const BEFORE = 100;
  const OCTOBER_BEST = 120;
  const NOVEMBER_LIFT = 110;
  const NOVEMBER_BEST = 130;
  const LAST_EVENING = 60;
  const SESSIONS = 3;
  // The helper also logs a set in an unfinished workout on 8 November: it is not counted.
  const SETS = SESSIONS;
  const HEAVIEST_EVER = 500;

  function lift(userId: string, startedAt: string, weightKg: number) {
    return db.workout.create({
      data: {
        userId,
        startedAt: new Date(startedAt),
        finishedAt: new Date(startedAt),
        sets: { create: [{ exerciseId, setNumber: 1, reps: REPS, weightKg }] },
      },
    });
  }

  it("counts the Toronto month, beats only earlier history, and ignores other users", async () => {
    const { user } = await athlete();
    const other = await athlete();
    await lift(user.id, "2026-10-15T17:00:00Z", BEFORE);
    // 22:00 on 31 Oct in Toronto is already 1 Nov in UTC: October's best, not November's.
    await lift(user.id, "2026-11-01T02:00:00Z", OCTOBER_BEST);
    await lift(user.id, "2026-11-10T17:00:00Z", NOVEMBER_LIFT);
    await lift(user.id, "2026-11-20T17:00:00Z", NOVEMBER_BEST);
    // 22:00 on 30 Nov in Toronto is already 1 Dec in UTC: still November.
    await lift(user.id, "2026-12-01T03:00:00Z", LAST_EVENING);
    await lift(other.user.id, "2026-11-12T17:00:00Z", NOVEMBER_BEST * 2);
    // Another user's older history must never become this user's "was".
    await lift(other.user.id, "2026-10-01T17:00:00Z", HEAVIEST_EVER);
    // An unfinished workout is not logged work: its set must not count or set a best.
    await db.workout.create({
      data: {
        userId: user.id,
        startedAt: new Date("2026-11-25T17:00:00Z"),
        sets: {
          create: [
            { exerciseId, setNumber: 1, reps: REPS, weightKg: HEAVIEST_EVER },
          ],
        },
      },
    });

    const input = await loadMonthlyReportInput(user.id, MONTH);
    expect(input.sessions).toBe(SESSIONS);
    expect(input.sets).toHaveLength(SETS);
    expect(input.priorBestKg).toEqual({ [exerciseId]: OCTOBER_BEST });

    const report = buildMonthlyReport(input);
    expect(report.personalBests).toEqual([
      expect.objectContaining({
        weightKg: NOVEMBER_BEST,
        previousKg: OCTOBER_BEST,
      }),
    ]);
    expect(report.muscles[0]).toMatchObject({
      muscle: "quadriceps",
      sets: SETS,
    });
  });

  it("stores the report in R2 and lets only its owner download it", async () => {
    const owner = await athlete();
    const intruder = await athlete();
    const row = await createExport(owner.user.id, "MONTHLY_REPORT", {
      storage: files,
    });
    expect(row.kind).toBe("MONTHLY_REPORT");
    expect(files.files.get(row.r2Key)?.contentType).toBe("application/pdf");

    session.userId = owner.user.id;
    const mine = await call(downloadExport, row.id);
    expect(mine.status).toBe(OK);
    expect(mine.headers.get("content-disposition")).toContain(
      "fitnesscoach-monthly-report-",
    );
    session.userId = intruder.user.id;
    expect((await call(downloadExport, row.id)).status).toBe(NOT_FOUND);
  });
});
