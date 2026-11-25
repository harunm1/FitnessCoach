import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, database } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: { user: { update: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { saveUnitPrefs } from "./unit-actions";

const idle = { status: "idle" as const };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.user.update.mockResolvedValue({});
});

describe("saveUnitPrefs", () => {
  it("saves both units for the signed-in user", async () => {
    const result = await saveUnitPrefs(
      idle,
      form({ weightUnit: "KG", distanceUnit: "KM" }),
    );
    expect(result).toEqual({ status: "saved" });
    expect(database.user.update).toHaveBeenCalledWith({
      where: { id: "session-owner" },
      data: { weightUnit: "KG", distanceUnit: "KM" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("ignores a user id sent in the form", async () => {
    await saveUnitPrefs(
      idle,
      form({ weightUnit: "LB", distanceUnit: "MI", userId: "someone-else" }),
    );
    expect(database.user.update.mock.calls[0][0].where).toEqual({
      id: "session-owner",
    });
  });

  it("refuses a unit that is not one of the four", async () => {
    const result = await saveUnitPrefs(
      idle,
      form({ weightUnit: "stone", distanceUnit: "MI" }),
    );
    expect(result.status).toBe("error");
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it("refuses a missing field", async () => {
    const result = await saveUnitPrefs(idle, form({ weightUnit: "LB" }));
    expect(result.status).toBe("error");
    expect(database.user.update).not.toHaveBeenCalled();
  });

  it("reports a database failure without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    database.user.update.mockRejectedValue(new Error("down"));
    const result = await saveUnitPrefs(
      idle,
      form({ weightUnit: "LB", distanceUnit: "MI" }),
    );
    expect(result.status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
