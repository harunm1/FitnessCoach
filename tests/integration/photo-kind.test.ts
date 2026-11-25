// Integration test for photo kind and the exercise link (D37) against a real
// PostgreSQL: the upload action stores both, a progress photo can't carry an
// exercise (the migration's CHECK), and deleting an exercise keeps the photo.
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

const { requireUser, storage } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  storage: { current: undefined as unknown },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: () => storage.current }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import { uploadProgressPhoto } from "@/app/progress/photos/actions";
import { prisma as db } from "@/lib/prisma";

const prefix = `photo-kind-${randomUUID()}`;
const exerciseId = `${prefix}-squat`;
const idle = { status: "idle" as const };
const SQUARE_PIXELS = 16;
let userId = "";

async function photoForm(fields: Record<string, string>) {
  const jpeg = await sharp({
    create: {
      width: SQUARE_PIXELS,
      height: SQUARE_PIXELS,
      channels: 3,
      background: "#4a7",
    },
  })
    .jpeg()
    .toBuffer();
  const data = new FormData();
  data.append(
    "photo",
    new File([new Uint8Array(jpeg)], "me.jpg", { type: "image/jpeg" }),
  );
  Object.entries(fields).forEach(([name, value]) => data.append(name, value));
  return data;
}

beforeAll(async () => {
  storage.current = new MemoryStorage();
  const user = await db.user.create({
    data: {
      name: "Photo kind athlete",
      email: `${prefix}@example.test`,
      emailVerified: true,
    },
  });
  userId = user.id;
  requireUser.mockResolvedValue({ id: userId });
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: "Squat",
      level: "BEGINNER",
      category: "strength",
      primaryMuscles: [],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    },
  });
});

afterAll(async () => {
  // Photos go with their user (onDelete: Cascade).
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.$disconnect();
});

describe("photo kind and exercise link", () => {
  it("stores a progress photo by default", async () => {
    await uploadProgressPhoto(idle, await photoForm({ note: "default" }));
    const row = await db.progressPhoto.findFirstOrThrow({
      where: { userId, note: "default" },
    });
    expect(row).toMatchObject({ kind: "PROGRESS", exerciseId: null });
  });

  it("stores a form photo with its exercise", async () => {
    const result = await uploadProgressPhoto(
      idle,
      await photoForm({ kind: "FORM", exerciseId, note: "linked" }),
    );
    expect(result).toEqual({ status: "saved" });
    const row = await db.progressPhoto.findFirstOrThrow({
      where: { userId, note: "linked" },
    });
    expect(row).toMatchObject({ kind: "FORM", exerciseId });
  });

  it("refuses an exercise that doesn't exist and stores nothing", async () => {
    const result = await uploadProgressPhoto(
      idle,
      await photoForm({ kind: "FORM", exerciseId: "nope", note: "missing" }),
    );
    expect(result).toEqual({
      status: "error",
      message: "That exercise couldn't be found.",
    });
    expect(
      await db.progressPhoto.count({ where: { userId, note: "missing" } }),
    ).toBe(0);
  });

  it("refuses, in the database, a progress photo that names an exercise", async () => {
    await expect(
      db.progressPhoto.create({
        data: {
          userId,
          storageKey: `${prefix}-bad`,
          kind: "PROGRESS",
          exerciseId,
        },
      }),
    ).rejects.toThrow(/ProgressPhoto_exercise_only_on_form/);
  });

  it("keeps a form photo, without its link, when the exercise is deleted", async () => {
    const linked = await db.progressPhoto.findFirstOrThrow({
      where: { userId, note: "linked" },
    });
    await db.exercise.delete({ where: { id: exerciseId } });
    const row = await db.progressPhoto.findUniqueOrThrow({
      where: { id: linked.id },
    });
    expect(row).toMatchObject({ kind: "FORM", exerciseId: null });
  });
});
