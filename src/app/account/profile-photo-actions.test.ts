import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "@/lib/storage/memory";

const { requireUser, revalidatePath, database, storage } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: { user: { findUnique: vi.fn(), update: vi.fn() } },
  storage: { current: undefined as unknown },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/storage", () => ({ getPhotoStorage: () => storage.current }));
import {
  editProfilePhoto,
  removeProfilePhoto,
  uploadProfilePhoto,
} from "./profile-photo-actions";

const idle = { status: "idle" as const };
const OLD = "profile/session-owner/old.webp";
const OLD_ORIGINAL = "profile/session-owner/old.original.webp";
let files: MemoryStorage;

function solid(width: number, height: number, background = "#4a7") {
  return sharp({ create: { width, height, channels: 3, background } });
}

// A 300 x 200 photo: red left half, blue right half.
async function redAndBlue() {
  const red = await solid(150, 200, "#f00").png().toBuffer();
  return solid(300, 200, "#00f")
    .composite([{ input: red, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function colourOf(body: Buffer | undefined) {
  const { channels } = await sharp(body).stats();
  return channels.map((channel) => Math.round(channel.mean));
}

function form(fields: Record<string, string | Blob>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

async function photoForm(fields: Record<string, string> = {}) {
  const jpeg = await solid(300, 200).jpeg().toBuffer();
  return form({ photo: new File([new Uint8Array(jpeg)], "me.jpg"), ...fields });
}

const framing = (left: number, top: number, side: number) => ({
  cropLeft: String(left),
  cropTop: String(top),
  cropWidth: String(side),
  cropHeight: String(side),
});

function newKeys() {
  return [...files.files.keys()].filter(
    (key) => key !== OLD && key !== OLD_ORIGINAL,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  files = new MemoryStorage();
  storage.current = files;
  await files.put(OLD, Buffer.from("old"), "image/webp");
  await files.put(OLD_ORIGINAL, Buffer.from("old original"), "image/webp");
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.user.findUnique.mockResolvedValue({ image: null });
  database.user.update.mockResolvedValue({});
});

describe("uploadProfilePhoto", () => {
  it("saves a 512 px square photo and records its key", async () => {
    expect(await uploadProfilePhoto(idle, await photoForm())).toEqual({
      status: "saved",
    });
    const key = newKeys().find((k) => !k.endsWith(".original.webp")) ?? "";
    expect(key).toMatch(/^profile\/session-owner\/[0-9a-f-]{36}\.webp$/);
    const out = await sharp(files.files.get(key)?.body).metadata();
    expect([out.format, out.width, out.height]).toEqual(["webp", 512, 512]);
    expect(database.user.update).toHaveBeenCalledWith({
      where: { id: "session-owner" },
      data: { image: key },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/progress/photos");
  });

  it("keeps the full original beside it for editing later", async () => {
    await uploadProfilePhoto(idle, await photoForm());
    const key = newKeys().find((k) => !k.endsWith(".original.webp")) ?? "";
    const original = files.files.get(key.replace(".webp", ".original.webp"));
    const out = await sharp(original?.body).metadata();
    expect([out.format, out.width, out.height]).toEqual(["webp", 300, 200]);
  });

  it("uses the framing chosen in the editor", async () => {
    const data = form({
      photo: new File([new Uint8Array(await redAndBlue())], "me.png"),
      ...framing(160, 20, 120),
    });
    expect(await uploadProfilePhoto(idle, data)).toEqual({ status: "saved" });
    const key = newKeys().find((k) => !k.endsWith(".original.webp")) ?? "";
    const [red, , blue] = await colourOf(files.files.get(key)?.body);
    expect(blue).toBeGreaterThan(200);
    expect(red).toBeLessThan(60);
  });

  it.each([
    ["a missing value", { cropLeft: "0", cropTop: "0", cropWidth: "100" }],
    ["a negative value", { ...framing(0, 0, 100), cropLeft: "-1" }],
    ["a zero size", { ...framing(0, 0, 100), cropWidth: "0" }],
    ["text instead of a number", { ...framing(0, 0, 100), cropLeft: "x" }],
  ])("rejects framing with %s", async (_name, fields) => {
    expect(await uploadProfilePhoto(idle, await photoForm(fields))).toEqual({
      status: "error",
      message: "That framing couldn't be used. Try again.",
    });
    expect(newKeys()).toHaveLength(0);
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it("deletes the old photo and its original only after the new one is saved", async () => {
    database.user.findUnique.mockResolvedValue({ image: OLD });
    await uploadProfilePhoto(idle, await photoForm());
    expect(files.files.has(OLD)).toBe(false);
    expect(files.files.has(OLD_ORIGINAL)).toBe(false);
    expect(newKeys()).toHaveLength(2);
  });

  it.each([
    ["a web address", "https://example.com/me.png"],
    ["another user's file", "profile/someone-else/me.webp"],
  ])("never deletes %s", async (_name, image) => {
    database.user.findUnique.mockResolvedValue({ image });
    const remove = vi.spyOn(files, "delete");
    await uploadProfilePhoto(idle, await photoForm());
    expect(remove).not.toHaveBeenCalled();
    expect(files.files.has(OLD)).toBe(true);
  });

  it("uses only the signed-in user, even with a forged user id", async () => {
    await uploadProfilePhoto(idle, await photoForm({ userId: "victim" }));
    expect(
      newKeys().every((key) => key.startsWith("profile/session-owner/")),
    ).toBe(true);
    expect(database.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session-owner" } }),
    );
  });

  it("does nothing for a signed-out user and keeps the sign-in redirect", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(uploadProfilePhoto(idle, await photoForm())).rejects.toThrow(
      "redirect:/sign-in",
    );
    expect(newKeys()).toHaveLength(0);
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it("asks for a photo when none is sent", async () => {
    expect(await uploadProfilePhoto(idle, new FormData())).toEqual({
      status: "error",
      message: "Choose a photo to upload.",
    });
  });

  it("shows the photo problem when the file is not an image", async () => {
    const data = form({ photo: new File(["hello"], "fake.jpg") });
    expect(await uploadProfilePhoto(idle, data)).toEqual({
      status: "error",
      message: "That file isn't an image we can read.",
    });
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it("explains, without details, when storage is unavailable", async () => {
    vi.spyOn(files, "put").mockRejectedValue(new Error("secret R2 details"));
    expect(await uploadProfilePhoto(idle, await photoForm())).toEqual({
      status: "error",
      message: "Your photo can't be saved right now. Try again later.",
    });
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it("removes the original again if saving the photo fails", async () => {
    const put = files.put.bind(files);
    vi.spyOn(files, "put").mockImplementation(async (key, body, type) => {
      if (!key.endsWith(".original.webp")) throw new Error("R2 is down");
      await put(key, body, type);
    });
    await uploadProfilePhoto(idle, await photoForm());
    expect(newKeys()).toHaveLength(0);
  });

  it("keeps the old photo and removes the new files if the database save fails", async () => {
    database.user.findUnique.mockResolvedValue({ image: OLD });
    database.user.update.mockRejectedValue(new Error("private details"));
    expect(await uploadProfilePhoto(idle, await photoForm())).toEqual({
      status: "error",
      message: "Your photo can't be saved right now. Try again later.",
    });
    expect(files.files.has(OLD)).toBe(true);
    expect(newKeys()).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("still saves when deleting the old photo fails", async () => {
    database.user.findUnique.mockResolvedValue({ image: OLD });
    vi.spyOn(files, "delete").mockRejectedValue(new Error("R2 is down"));
    expect(await uploadProfilePhoto(idle, await photoForm())).toEqual({
      status: "saved",
    });
  });
});

describe("editProfilePhoto", () => {
  beforeEach(async () => {
    database.user.findUnique.mockResolvedValue({ image: OLD });
    await files.put(OLD_ORIGINAL, await redAndBlue(), "image/webp");
  });

  it("reframes the photo from its full original", async () => {
    expect(await editProfilePhoto(idle, form(framing(160, 20, 120)))).toEqual({
      status: "saved",
    });
    const [red, , blue] = await colourOf(files.files.get(OLD)?.body);
    expect(blue).toBeGreaterThan(200);
    expect(red).toBeLessThan(60);
    const out = await sharp(files.files.get(OLD)?.body).metadata();
    expect([out.width, out.height]).toEqual([512, 512]);
  });

  it("keeps the same key and the original, so nothing else changes", async () => {
    await editProfilePhoto(idle, form(framing(0, 0, 200)));
    expect(database.user.update).not.toHaveBeenCalled();
    expect(files.files.has(OLD_ORIGINAL)).toBe(true);
    expect(newKeys()).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/progress/photos");
  });

  it.each([
    ["no framing", {}],
    ["broken framing", { ...framing(0, 0, 100), cropWidth: "0" }],
  ])("rejects %s", async (_name, fields) => {
    expect(await editProfilePhoto(idle, form(fields))).toEqual({
      status: "error",
      message: "That framing couldn't be used. Try again.",
    });
    expect(files.files.get(OLD)?.body.toString()).toBe("old");
  });

  it.each([
    ["no photo", null],
    ["a web address", "https://example.com/me.png"],
    ["another user's file", "profile/someone-else/me.webp"],
  ])("refuses to edit %s", async (_name, image) => {
    database.user.findUnique.mockResolvedValue({ image });
    const put = vi.spyOn(files, "put");
    expect(await editProfilePhoto(idle, form(framing(0, 0, 100)))).toEqual({
      status: "error",
      message: "There's no photo to edit.",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("asks to choose the photo again when its original is missing", async () => {
    await files.delete(OLD_ORIGINAL);
    expect(await editProfilePhoto(idle, form(framing(0, 0, 100)))).toEqual({
      status: "error",
      message: "This photo can't be edited. Choose it again to reframe it.",
    });
  });

  it("explains, without details, when storage is unavailable", async () => {
    vi.spyOn(files, "put").mockRejectedValue(new Error("secret R2 details"));
    expect(await editProfilePhoto(idle, form(framing(0, 0, 100)))).toEqual({
      status: "error",
      message: "Your photo can't be saved right now. Try again later.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("uses only the signed-in user's photo", async () => {
    await editProfilePhoto(idle, form({ ...framing(0, 0, 100), userId: "x" }));
    expect(database.user.findUnique).toHaveBeenCalledWith({
      where: { id: "session-owner" },
      select: { image: true },
    });
  });

  it("does nothing for a signed-out user and keeps the sign-in redirect", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    const put = vi.spyOn(files, "put");
    await expect(
      editProfilePhoto(idle, form(framing(0, 0, 100))),
    ).rejects.toThrow("redirect:/sign-in");
    expect(put).not.toHaveBeenCalled();
  });
});

describe("removeProfilePhoto", () => {
  it("clears the photo and deletes it with its original", async () => {
    database.user.findUnique.mockResolvedValue({ image: OLD });
    expect(await removeProfilePhoto()).toEqual({ status: "removed" });
    expect(database.user.update).toHaveBeenCalledWith({
      where: { id: "session-owner" },
      data: { image: null },
    });
    expect(files.files.has(OLD)).toBe(false);
    expect(files.files.has(OLD_ORIGINAL)).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/progress/photos");
  });

  it("does nothing when there is no photo", async () => {
    expect(await removeProfilePhoto()).toEqual({ status: "removed" });
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it("clears a web address without trying to delete it", async () => {
    const remove = vi.spyOn(files, "delete");
    database.user.findUnique.mockResolvedValue({
      image: "https://example.com/me.png",
    });
    expect(await removeProfilePhoto()).toEqual({ status: "removed" });
    expect(database.user.update).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("still removes the photo when storage is unavailable", async () => {
    database.user.findUnique.mockResolvedValue({ image: OLD });
    storage.current = undefined;
    expect(await removeProfilePhoto()).toEqual({ status: "removed" });
    expect(database.user.update).toHaveBeenCalled();
  });

  it("explains, without details, when the database fails", async () => {
    database.user.findUnique.mockResolvedValue({ image: OLD });
    database.user.update.mockRejectedValue(new Error("private details"));
    expect(await removeProfilePhoto()).toEqual({
      status: "error",
      message: "Your photo couldn't be removed. Try again.",
    });
    expect(files.files.has(OLD)).toBe(true);
  });

  it("does nothing for a signed-out user and keeps the sign-in redirect", async () => {
    requireUser.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(removeProfilePhoto()).rejects.toThrow("redirect:/sign-in");
    expect(database.user.update).not.toHaveBeenCalled();
  });
});
