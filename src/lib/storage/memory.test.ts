import { describe, expect, it } from "vitest";
import { MemoryStorage } from "./memory";

describe("MemoryStorage", () => {
  it("saves the bytes and content type under the key", async () => {
    const storage = new MemoryStorage();
    const body = Buffer.from("photo");
    await storage.put("photos/a.webp", body, "image/webp");
    expect(storage.files.get("photos/a.webp")).toEqual({
      body,
      contentType: "image/webp",
    });
  });

  it("replaces a file saved under the same key", async () => {
    const storage = new MemoryStorage();
    await storage.put("photos/a.webp", Buffer.from("old"), "image/webp");
    await storage.put("photos/a.webp", Buffer.from("new"), "image/png");
    expect(storage.files.size).toBe(1);
    expect(storage.files.get("photos/a.webp")?.body.toString()).toBe("new");
    expect(storage.files.get("photos/a.webp")?.contentType).toBe("image/png");
  });

  it("reads back a saved file, or null when there is none", async () => {
    const storage = new MemoryStorage();
    await storage.put("photos/a.webp", Buffer.from("a"), "image/webp");
    expect((await storage.get("photos/a.webp"))?.toString()).toBe("a");
    expect(await storage.get("missing")).toBeNull();
  });

  it("deletes only the given key", async () => {
    const storage = new MemoryStorage();
    await storage.put("photos/a.webp", Buffer.from("a"), "image/webp");
    await storage.put("photos/b.webp", Buffer.from("b"), "image/webp");
    await storage.delete("photos/a.webp");
    expect([...storage.files.keys()]).toEqual(["photos/b.webp"]);
  });

  it("does not fail when deleting a key that does not exist", async () => {
    await expect(
      new MemoryStorage().delete("missing"),
    ).resolves.toBeUndefined();
  });

  it("returns a link that names the key and expiry", async () => {
    const url = await new MemoryStorage().signedUrl("photos/a.webp", 300);
    expect(url).toBe("memory://photos/a.webp?expires=300");
  });
});
