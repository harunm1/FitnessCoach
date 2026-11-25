import { beforeEach, describe, expect, it, vi } from "vitest";

const { database } = vi.hoisted(() => ({
  database: { user: { findUnique: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
import { loadUnitPrefs } from "./prefs";

beforeEach(() => vi.clearAllMocks());

describe("loadUnitPrefs", () => {
  it("returns the units saved on the user", async () => {
    database.user.findUnique.mockResolvedValue({
      weightUnit: "KG",
      distanceUnit: "KM",
    });
    await expect(loadUnitPrefs("u1")).resolves.toEqual({
      weightUnit: "KG",
      distanceUnit: "KM",
    });
    expect(database.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { weightUnit: true, distanceUnit: true },
    });
  });

  it("falls back to pounds and kilometres when there is no row", async () => {
    database.user.findUnique.mockResolvedValue(null);
    await expect(loadUnitPrefs("u1")).resolves.toEqual({
      weightUnit: "LB",
      distanceUnit: "KM",
    });
  });
});
