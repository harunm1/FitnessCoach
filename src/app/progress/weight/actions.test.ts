import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, revalidatePath, database } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: { bodyWeight: { upsert: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: database }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { logBodyWeight } from "./actions";

const idle = { status: "idle" as const };
// 15:00 UTC on 24 Nov is 10:00 in Toronto, the same day.
const NOW = new Date("2026-11-24T15:00:00Z");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

let logged: ReturnType<typeof vi.spyOn>;

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  requireUser.mockResolvedValue({ id: "session-owner" });
  database.bodyWeight.upsert.mockResolvedValue({ id: 1 });
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("logBodyWeight", () => {
  it("saves the weight for the signed-in user, keyed by user and day", async () => {
    const result = await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "81.5", note: "Morning" }),
    );
    expect(result).toEqual({ status: "saved", date: "2026-11-23" });
    const day = new Date("2026-11-23T00:00:00Z");
    expect(database.bodyWeight.upsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: "session-owner", date: day } },
      create: {
        userId: "session-owner",
        date: day,
        weightKg: 81.5,
        note: "Morning",
      },
      update: { weightKg: 81.5, note: "Morning" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/progress");
  });

  it("ignores a user id sent in the form", async () => {
    await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "81.5", userId: "someone-else" }),
    );
    const call = database.bodyWeight.upsert.mock.calls[0][0];
    expect(call.where.userId_date.userId).toBe("session-owner");
    expect(call.create.userId).toBe("session-owner");
  });

  it("clears an earlier note when the same day is logged again without one", async () => {
    await logBodyWeight(idle, form({ date: "2026-11-23", weightKg: "81" }));
    expect(database.bodyWeight.upsert.mock.calls[0][0].update).toEqual({
      weightKg: 81,
      note: null,
    });
  });

  it("uses the Toronto day for today", async () => {
    // 03:00 UTC on 25 Nov is still 24 Nov in Toronto, so 25 Nov is the future.
    vi.setSystemTime(new Date("2026-11-25T03:00:00Z"));
    const tomorrow = await logBodyWeight(
      idle,
      form({ date: "2026-11-25", weightKg: "81" }),
    );
    expect(tomorrow).toMatchObject({
      status: "error",
      message: "That day hasn't happened yet.",
    });
    const today = await logBodyWeight(
      idle,
      form({ date: "2026-11-24", weightKg: "81" }),
    );
    expect(today.status).toBe("saved");
  });

  it("refuses a weight out of range without touching the database", async () => {
    const result = await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "5" }),
    );
    // The typed values come back, so the form can show them again.
    expect(result).toEqual({
      status: "error",
      message: "Enter a weight between 20 and 400 kg.",
      values: { date: "2026-11-23", weightKg: "5", note: "" },
    });
    expect(database.bodyWeight.upsert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats missing fields as invalid, not as a crash", async () => {
    const result = await logBodyWeight(idle, new FormData());
    expect(result.status).toBe("error");
    expect(database.bodyWeight.upsert).not.toHaveBeenCalled();
  });

  it("says the weight couldn't be saved when the database fails, and logs why", async () => {
    database.bodyWeight.upsert.mockRejectedValue(new Error("connection lost"));
    const result = await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "81" }),
    );
    expect(result).toEqual({
      status: "error",
      message: "Your weight couldn't be saved right now. Try again.",
      values: { date: "2026-11-23", weightKg: "81", note: "" },
    });
    expect(logged).toHaveBeenCalledWith(
      "[weight] saving failed",
      expect.objectContaining({ userId: "session-owner" }),
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets a signed-out user's redirect through", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    requireUser.mockRejectedValue(redirect);
    await expect(
      logBodyWeight(idle, form({ date: "2026-11-23", weightKg: "81" })),
    ).rejects.toBe(redirect);
    expect(database.bodyWeight.upsert).not.toHaveBeenCalled();
  });
});

describe("logBodyWeight units", () => {
  it("converts pounds typed under a pound label to kilograms", async () => {
    const result = await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "180", weightUnit: "LB" }),
    );
    expect(result).toEqual({ status: "saved", date: "2026-11-23" });
    expect(database.bodyWeight.upsert.mock.calls[0][0].create.weightKg).toBe(
      81.65,
    );
  });

  it("treats a form with no unit as kilograms", async () => {
    await logBodyWeight(idle, form({ date: "2026-11-23", weightKg: "81.5" }));
    expect(database.bodyWeight.upsert.mock.calls[0][0].create.weightKg).toBe(
      81.5,
    );
  });

  it("refuses a unit that is not kg or lb", async () => {
    const result = await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "180", weightUnit: "stone" }),
    );
    expect(result.status).toBe("error");
    expect(database.bodyWeight.upsert).not.toHaveBeenCalled();
  });

  it("states the limits in pounds when the form was in pounds", async () => {
    const result = await logBodyWeight(
      idle,
      form({ date: "2026-11-23", weightKg: "10", weightUnit: "LB" }),
    );
    expect(result).toMatchObject({
      status: "error",
      message: "Enter a weight between 45 and 881 lb.",
    });
  });
});
