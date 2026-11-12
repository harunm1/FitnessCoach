import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

const { requireUser, revalidatePath, database, storage } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: {
    progressPhoto: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  },
  storage: { current: undefined as unknown },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: () => storage.current }));
import { deleteProgressPhoto, uploadProgressPhoto } from "./actions";

const idle = { status: "idle" as const };
let files: MemoryStorage;

async function jpeg() {
  return sharp({
    create: { width: 40, height: 20, channels: 3, background: "#4a7" },
  })
    .jpeg()
    .toBuffer();
}

function form(fields: Record<string, string | Blob>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

async function photoForm(fields: Record<string, string> = {}) {
  return form({
    photo: new File([new Uint8Array(await jpeg())], "me.jpg", {
      type: "image/jpeg",
    }),
    ...fields,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  files = new MemoryStorage();
  storage.current = files;
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.progressPhoto.create.mockResolvedValue({ id: 1 });
  database.progressPhoto.findFirst.mockResolvedValue({
    id: 7,
    storageKey: "progress/session-owner/a.webp",
  });
  database.progressPhoto.delete.mockResolvedValue({ id: 7 });
});

describe("uploadProgressPhoto", () => {
  it("saves the processed photo and records only its key", async () => {
    const result = await uploadProgressPhoto(
      idle,
      await photoForm({ weightKg: "72.5", note: " After week 4 " }),
    );

    expect(result).toEqual({ status: "saved" });
    const [key] = [...files.files.keys()];
    expect(key).toMatch(/^progress\/session-owner\/[0-9a-f-]{36}\.webp$/);
    expect(files.files.get(key)?.contentType).toBe("image/webp");
    expect((await sharp(files.files.get(key)?.body).metadata()).format).toBe(
      "webp",
    );
    expect(database.progressPhoto.create).toHaveBeenCalledWith({
      data: {
        userId: "session-owner",
        storageKey: key,
        weightKg: 72.5,
        note: "After week 4",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/progress/photos");
  });

  it("leaves weight and note out when they are blank", async () => {
    await uploadProgressPhoto(
      idle,
      await photoForm({ weightKg: " ", note: "" }),
    );
    expect(database.progressPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ weightKg: undefined, note: undefined }),
    });
  });

  it("uses only the signed-in user, even with a forged user id", async () => {
    await uploadProgressPhoto(idle, await photoForm({ userId: "victim" }));
    const [key] = [...files.files.keys()];
    expect(key.startsWith("progress/session-owner/")).toBe(true);
    expect(database.progressPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "session-owner" }),
    });
  });

  it("does nothing for a signed-out user and keeps the sign-in redirect", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(uploadProgressPhoto(idle, await photoForm())).rejects.toThrow(
      "redirect:/sign-in",
    );
    expect(files.files.size).toBe(0);
    expect(database.progressPhoto.create).not.toHaveBeenCalled();
  });

  it.each([
    ["no file", form({})],
    ["an empty file", form({ photo: new File([], "empty.jpg") })],
  ])("asks for a photo when given %s", async (_name, data) => {
    expect(await uploadProgressPhoto(idle, data)).toEqual({
      status: "error",
      message: "Choose a photo to upload.",
    });
    expect(files.files.size).toBe(0);
  });

  it("rejects a file over 10 MB", async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg");
    expect(await uploadProgressPhoto(idle, form({ photo: big }))).toEqual({
      status: "error",
      message: "Photos can be up to 10 MB.",
    });
    expect(files.files.size).toBe(0);
  });

  it("shows the photo problem when the file is not an image", async () => {
    const text = new File(["hello"], "fake.jpg", { type: "image/jpeg" });
    expect(await uploadProgressPhoto(idle, form({ photo: text }))).toEqual({
      status: "error",
      message: "That file isn't an image we can read.",
    });
    expect(files.files.size).toBe(0);
    expect(database.progressPhoto.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a weight below 20 kg",
      { weightKg: "5" },
      "Enter a weight between 20 and 400 kg.",
    ],
    [
      "a weight above 400 kg",
      { weightKg: "401" },
      "Enter a weight between 20 and 400 kg.",
    ],
    [
      "a weight that is not a number",
      { weightKg: "abc" },
      "Enter a weight between 20 and 400 kg.",
    ],
    [
      "a note over 300 characters",
      { note: "x".repeat(301) },
      "Keep the note to 300 characters.",
    ],
  ])("rejects %s before saving anything", async (_name, fields, message) => {
    expect(await uploadProgressPhoto(idle, await photoForm(fields))).toEqual({
      status: "error",
      message,
    });
    expect(files.files.size).toBe(0);
    expect(database.progressPhoto.create).not.toHaveBeenCalled();
  });

  it("explains, without details, when storage is unavailable", async () => {
    storage.current = {
      put: vi.fn().mockRejectedValue(new Error("secret R2 details")),
      delete: vi.fn(),
      signedUrl: vi.fn(),
    };
    expect(await uploadProgressPhoto(idle, await photoForm())).toEqual({
      status: "error",
      message: "Photos can't be saved right now. Try again later.",
    });
    expect(database.progressPhoto.create).not.toHaveBeenCalled();
  });

  it("removes the uploaded file if the database save fails", async () => {
    database.progressPhoto.create.mockRejectedValue(
      new Error("private connection details"),
    );
    expect(await uploadProgressPhoto(idle, await photoForm())).toEqual({
      status: "error",
      message: "Photos can't be saved right now. Try again later.",
    });
    expect(files.files.size).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteProgressPhoto", () => {
  beforeEach(async () => {
    await files.put(
      "progress/session-owner/a.webp",
      Buffer.from("a"),
      "image/webp",
    );
  });

  it("deletes the owner's photo and its file", async () => {
    expect(await deleteProgressPhoto(idle, form({ photoId: "7" }))).toEqual({
      status: "deleted",
    });
    expect(database.progressPhoto.findFirst).toHaveBeenCalledWith({
      where: { id: 7, userId: "session-owner" },
      select: { id: true, storageKey: true },
    });
    expect(database.progressPhoto.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
    expect(files.files.size).toBe(0);
    expect(revalidatePath).toHaveBeenCalledWith("/progress/photos");
  });

  it("does not delete someone else's photo", async () => {
    database.progressPhoto.findFirst.mockResolvedValue(null);
    expect(await deleteProgressPhoto(idle, form({ photoId: "8" }))).toEqual({
      status: "error",
      message: "That photo couldn't be found.",
    });
    expect(database.progressPhoto.delete).not.toHaveBeenCalled();
    expect(files.files.size).toBe(1);
  });

  it.each(["", "abc", "-1", "1.5"])(
    "treats the id %j as not found",
    async (photoId) => {
      expect(await deleteProgressPhoto(idle, form({ photoId }))).toEqual({
        status: "error",
        message: "That photo couldn't be found.",
      });
      expect(database.progressPhoto.findFirst).not.toHaveBeenCalled();
    },
  );

  it("does nothing for a signed-out user and keeps the sign-in redirect", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(
      deleteProgressPhoto(idle, form({ photoId: "7" })),
    ).rejects.toThrow("redirect:/sign-in");
    expect(database.progressPhoto.delete).not.toHaveBeenCalled();
  });

  it("explains, without details, when the database fails", async () => {
    database.progressPhoto.delete.mockRejectedValue(
      new Error("private connection details"),
    );
    expect(await deleteProgressPhoto(idle, form({ photoId: "7" }))).toEqual({
      status: "error",
      message: "That photo couldn't be deleted. Try again.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("finishes the job when the user retries after a database failure", async () => {
    database.progressPhoto.delete.mockRejectedValueOnce(new Error("db down"));
    await deleteProgressPhoto(idle, form({ photoId: "7" }));
    // The file is already gone; deleting it again succeeds, then the row goes.
    expect(await deleteProgressPhoto(idle, form({ photoId: "7" }))).toEqual({
      status: "deleted",
    });
    expect(database.progressPhoto.delete).toHaveBeenCalledTimes(2);
    expect(files.files.size).toBe(0);
  });

  it("keeps the photo so the user can retry if removing the file fails", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("R2 is down"));
    storage.current = { put: vi.fn(), delete: remove, signedUrl: vi.fn() };
    expect(await deleteProgressPhoto(idle, form({ photoId: "7" }))).toEqual({
      status: "error",
      message: "That photo couldn't be deleted. Try again.",
    });
    expect(remove).toHaveBeenCalledWith("progress/session-owner/a.webp");
    expect(database.progressPhoto.delete).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
