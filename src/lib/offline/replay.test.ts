// Replay of the offline set queue (D31): oldest first, one at a time, stops at the first
// failure and never drops an item that was not confirmed by the server.
import { describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "./queueStore";
import { replayQueue } from "./replay";
import type { QueuedSet, SyncOutcome } from "./types";

const USER = "user-1";
const WORKOUT_ID = 7;
const REPS = 8;
const SET_ONE = 1;
const SET_TWO = 2;
const SET_THREE = 3;
const T1 = 1_000;
const T2 = 2_000;
const T3 = 3_000;
const ALL_THREE = 3;
const BOTH = 2;

function queued(overrides: Partial<QueuedSet>): QueuedSet {
  return {
    clientId: "00000000-0000-4000-8000-000000000001",
    userId: USER,
    workoutId: WORKOUT_ID,
    exerciseId: "press",
    setNumber: SET_ONE,
    reps: REPS,
    weightKg: "12",
    painDuringSession: null,
    painNextMorning: null,
    queuedAt: T1,
    error: null,
    ...overrides,
  };
}

const first = queued({ clientId: "a", setNumber: SET_ONE, queuedAt: T1 });
const second = queued({ clientId: "b", setNumber: SET_TWO, queuedAt: T2 });
const third = queued({ clientId: "c", setNumber: SET_THREE, queuedAt: T3 });

describe("replayQueue", () => {
  it("sends items oldest first and removes each one the server confirms", async () => {
    const store = createMemoryStore([third, first, second]);
    const sent: string[] = [];
    const send = vi.fn(async (item: QueuedSet): Promise<SyncOutcome> => {
      sent.push(item.clientId);
      return { status: "saved" };
    });

    const result = await replayQueue(store, USER, send);

    expect(sent).toEqual(["a", "b", "c"]);
    expect(result).toEqual({ synced: ALL_THREE, failure: null });
    expect(await store.all()).toEqual([]);
  });

  it("treats an item the server already has as synced", async () => {
    const store = createMemoryStore([first]);
    const result = await replayQueue(store, USER, async () => ({
      status: "duplicate",
    }));
    expect(result.synced).toBe(1);
    expect(await store.all()).toEqual([]);
  });

  it("keeps the item and every later one when the server refuses it, and records why", async () => {
    const store = createMemoryStore([first, second]);
    const send = vi.fn(async (): Promise<SyncOutcome> => ({
      status: "error",
      message: "That set is out of date.",
    }));

    const result = await replayQueue(store, USER, send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      synced: 0,
      failure: {
        clientId: "a",
        kind: "rejected",
        message: "That set is out of date.",
      },
    });
    const left = await store.all();
    expect(left.map((item) => item.clientId).sort()).toEqual(["a", "b"]);
    expect(left.find((item) => item.clientId === "a")?.error).toBe(
      "That set is out of date.",
    );
  });

  it("keeps every item when the request itself fails (no connection)", async () => {
    const store = createMemoryStore([first, second]);
    const result = await replayQueue(store, USER, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result).toEqual({
      synced: 0,
      failure: { clientId: "a", kind: "network", message: "Failed to fetch" },
    });
    expect(await store.all()).toHaveLength(BOTH);
  });

  it("stops after a confirmed item when the next one fails", async () => {
    const store = createMemoryStore([first, second]);
    const send = vi
      .fn<(item: QueuedSet) => Promise<SyncOutcome>>()
      .mockResolvedValueOnce({ status: "saved" })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await replayQueue(store, USER, send);
    expect(result.synced).toBe(1);
    expect((await store.all()).map((item) => item.clientId)).toEqual(["b"]);
  });

  it("clears an old error once the item is retried and saved", async () => {
    const store = createMemoryStore([
      { ...first, error: "Could not reach the server." },
    ]);
    await replayQueue(store, USER, async () => ({ status: "saved" }));
    expect(await store.all()).toEqual([]);
  });

  it("never sends another user's queued sets", async () => {
    const store = createMemoryStore([
      first,
      queued({ clientId: "z", userId: "user-2" }),
    ]);
    const send = vi.fn(async (): Promise<SyncOutcome> => ({ status: "saved" }));
    await replayQueue(store, USER, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await store.all()).map((item) => item.clientId)).toEqual(["z"]);
  });
});
