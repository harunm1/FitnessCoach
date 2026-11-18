import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const SETTINGS = {
  R2_ACCOUNT_ID: "acct123",
  R2_ACCESS_KEY_ID: "test-key-id",
  R2_SECRET_ACCESS_KEY: "test-secret",
  R2_BUCKET: "test-bucket",
};

function setEnv(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

// Each test gets a fresh copy of the module, so the saved storage starts empty.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getPhotoStorage", () => {
  it("can be imported without any R2 settings", async () => {
    setEnv({
      R2_ACCOUNT_ID: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
      R2_BUCKET: "",
    });
    await expect(import("./index")).resolves.toBeDefined();
  });

  it("explains which settings are missing when used", async () => {
    setEnv({ ...SETTINGS, R2_SECRET_ACCESS_KEY: "" });
    const { getPhotoStorage } = await import("./index");
    expect(() => getPhotoStorage()).toThrow("Missing: R2_SECRET_ACCESS_KEY");
  });

  it("creates the storage once and reuses it", async () => {
    setEnv(SETTINGS);
    const { getPhotoStorage } = await import("./index");
    const first = getPhotoStorage();
    expect(getPhotoStorage()).toBe(first);
    expect(await first.signedUrl("a.webp", 60)).toContain(
      "acct123.r2.cloudflarestorage.com",
    );
  });
});
