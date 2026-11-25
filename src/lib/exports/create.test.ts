import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

const { database } = vi.hoisted(() => ({
  database: {
    dataExport: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    setLog: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: database }));

import { UTF8_BOM } from "./csv";
import {
  createExport,
  EXPORTS_PER_HOUR,
  ExportError,
  EXPORTS_KEPT,
  MAX_EXPORT_BYTES,
} from "./create";

const NOW = new Date("2026-11-25T15:00:00Z");
const ONE_HOUR_MS = 3_600_000;
const HUNDRED_KG = 100;
const SET_COUNT = 3;
const UUID_LENGTH = 36;
const BIG_MESSAGE = "x".repeat(MAX_EXPORT_BYTES);
let storage: MemoryStorage;

function setRow(overrides = {}) {
  return {
    setNumber: 1,
    reps: SET_COUNT,
    weightKg: { toString: () => String(HUNDRED_KG) },
    rpe: null,
    exercise: { name: "Squat" },
    workout: { startedAt: NOW, notes: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage = new MemoryStorage();
  database.dataExport.count.mockResolvedValue(0);
  database.dataExport.create.mockImplementation(async ({ data }) => ({
    id: "export-1",
    createdAt: NOW,
    ...data,
  }));
  database.dataExport.findMany.mockResolvedValue([]);
  database.setLog.findMany.mockResolvedValue([setRow()]);
  database.message.findMany.mockResolvedValue([]);
  database.user.findUnique.mockResolvedValue({
    weightUnit: "LB",
    distanceUnit: "KM",
  });
});

describe("createExport", () => {
  it("stores the workout CSV in R2 and records it in the table", async () => {
    const row = await createExport("u1", "WORKOUT_CSV", { storage, now: NOW });

    const [[key, file]] = [...storage.files.entries()];
    expect(key.startsWith("exports/u1/")).toBe(true);
    expect(key.endsWith(".csv")).toBe(true);
    expect(key.length).toBe("exports/u1/".length + UUID_LENGTH + ".csv".length);
    expect(file.contentType).toBe("text/csv; charset=utf-8");
    expect(file.contentDisposition).toBe(
      `attachment; filename="fitnesscoach-workouts-2026-11-25.csv"; filename*=UTF-8''fitnesscoach-workouts-2026-11-25.csv`,
    );
    const text = file.body.toString("utf8");
    expect(text.startsWith(UTF8_BOM + "date,exercise,set,weight,unit")).toBe(
      true,
    );
    expect(text).toContain("Squat,1,220.5,lb,3");
    expect(database.dataExport.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        kind: "WORKOUT_CSV",
        r2Key: key,
        bytes: file.body.byteLength,
      },
    });
    expect(row.id).toBe("export-1");
  });

  it("reads only this user's sets and messages", async () => {
    await createExport("u1", "WORKOUT_CSV", { storage, now: NOW });
    expect(database.setLog.findMany.mock.calls[0][0].where).toEqual({
      workout: { userId: "u1" },
    });
    await createExport("u1", "COACH_CSV", { storage, now: NOW });
    expect(database.message.findMany.mock.calls[0][0].where).toEqual({
      conversation: { userId: "u1" },
    });
  });

  it("writes the coach conversations as a CSV", async () => {
    database.message.findMany.mockResolvedValue([
      { createdAt: NOW, role: "USER", content: 'say "hi", please' },
    ]);
    await createExport("u1", "COACH_CSV", { storage, now: NOW });
    const [[, file]] = [...storage.files.entries()];
    expect(file.body.toString("utf8")).toContain(
      '2026-11-25T15:00:00.000Z,user,"say ""hi"", please"',
    );
    expect(file.contentDisposition).toContain("fitnesscoach-coach-chat-");
  });

  it("refuses an eleventh export in an hour and saves nothing", async () => {
    database.dataExport.count.mockResolvedValue(EXPORTS_PER_HOUR);
    await expect(
      createExport("u1", "WORKOUT_CSV", { storage, now: NOW }),
    ).rejects.toMatchObject({ code: "rate-limited" });
    expect(database.dataExport.count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        createdAt: { gte: new Date(NOW.getTime() - ONE_HOUR_MS) },
      },
    });
    expect(storage.files.size).toBe(0);
    expect(database.dataExport.create).not.toHaveBeenCalled();
  });

  it("refuses a file too big to send back and saves nothing", async () => {
    database.message.findMany.mockResolvedValue([
      { createdAt: NOW, role: "USER", content: BIG_MESSAGE },
    ]);
    await expect(
      createExport("u1", "COACH_CSV", { storage, now: NOW }),
    ).rejects.toMatchObject({ code: "too-large" });
    expect(storage.files.size).toBe(0);
  });

  it("removes the file again when the table row can't be saved", async () => {
    database.dataExport.create.mockRejectedValue(new Error("db down"));
    await expect(
      createExport("u1", "WORKOUT_CSV", { storage, now: NOW }),
    ).rejects.toThrow("db down");
    expect(storage.files.size).toBe(0);
  });

  it("keeps the newest exports and removes the older ones from R2 and the table", async () => {
    await storage.put("exports/u1/old.csv", Buffer.from("x"), "text/csv");
    database.dataExport.findMany.mockResolvedValue([
      { id: "old-1", r2Key: "exports/u1/old.csv" },
    ]);
    await createExport("u1", "WORKOUT_CSV", { storage, now: NOW });

    expect(database.dataExport.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: EXPORTS_KEPT,
      select: { id: true, r2Key: true },
    });
    expect(storage.files.has("exports/u1/old.csv")).toBe(false);
    expect(database.dataExport.delete).toHaveBeenCalledWith({
      where: { id: "old-1" },
    });
  });

  it("still succeeds when removing an old export fails", async () => {
    database.dataExport.findMany.mockRejectedValue(new Error("db blip"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      createExport("u1", "WORKOUT_CSV", { storage, now: NOW }),
    ).resolves.toBeDefined();
    log.mockRestore();
  });

  it("has no generator for the report yet", async () => {
    await expect(
      createExport("u1", "MONTHLY_REPORT", { storage, now: NOW }),
    ).rejects.toBeInstanceOf(ExportError);
  });
});
