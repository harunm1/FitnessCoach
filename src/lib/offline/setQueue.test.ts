// The offline set queue as the session view uses it (D31): sets logged offline wait on the
// device, replay when the browser is back online or the page loads, and a failure is shown
// and kept, never dropped.
import { describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "./queueStore";
import { createSetQueue, type NewQueuedSet } from "./setQueue";
import type { QueuedSet, SyncOutcome } from "./types";

const USER = "user-1";
const WORKOUT_ID = 7;
const REPS = 8;
const SET_ONE = 1;
const SET_TWO = 2;
const BOTH = 2;
const NOW = 10_000;

function newSet(clientId: string, setNumber = SET_ONE): NewQueuedSet {
  return {
    clientId,
    workoutId: WORKOUT_ID,
    exerciseId: "press",
    setNumber,
    reps: REPS,
    weightKg: "12",
    painDuringSession: null,
    painNextMorning: null,
  };
}

function setup(options: {
  online: boolean;
  send?: (item: QueuedSet) => Promise<SyncOutcome>;
  initial?: QueuedSet[];
}) {
  let online = options.online;
  const store = createMemoryStore(options.initial ?? []);
  const send = vi.fn(
    options.send ?? (async (): Promise<SyncOutcome> => ({ status: "saved" })),
  );
  const onSynced = vi.fn();
  const queue = createSetQueue({
    openStore: async () => store,
    send,
    isOnline: () => online,
    now: () => NOW,
    onSynced,
  });
  return {
    queue,
    store,
    send,
    onSynced,
    goOnline: async () => {
      online = true;
      await queue.setOnline(true);
    },
  };
}

describe("createSetQueue", () => {
  it("resolves a new set once it is stored, without waiting for the network", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { queue } = setup({
      online: true,
      send: async () => {
        await gate;
        return { status: "saved" };
      },
    });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    expect(queue.getSnapshot()).toMatchObject({ syncing: true });
    expect(queue.getSnapshot().items).toHaveLength(1);
    release();
    await queue.idle();
    expect(queue.getSnapshot().items).toEqual([]);
  });

  it("keeps sets logged offline on the device and counts them", async () => {
    const { queue, send, store } = setup({ online: false });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    await queue.enqueue(newSet("b", SET_TWO));

    expect(send).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toMatchObject({
      online: false,
      syncing: false,
      failure: null,
    });
    expect(queue.getSnapshot().items).toHaveLength(BOTH);
    expect((await store.all())[0]).toMatchObject({
      userId: USER,
      queuedAt: NOW,
      error: null,
    });
  });

  it("stores a double tap of the same set attempt once", async () => {
    const { queue } = setup({ online: false });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    await queue.enqueue(newSet("a"));
    expect(queue.getSnapshot().items).toHaveLength(1);
  });

  it("sends the queue in order when the browser comes back online", async () => {
    const { queue, send, goOnline, onSynced } = setup({ online: false });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    await queue.enqueue(newSet("b", SET_TWO));

    await goOnline();

    expect(send.mock.calls.map(([item]) => item.clientId)).toEqual(["a", "b"]);
    expect(queue.getSnapshot()).toMatchObject({
      items: [],
      online: true,
      syncing: false,
      justSynced: true,
    });
    expect(onSynced).toHaveBeenCalledTimes(1);
  });

  it("sends a set right away when online", async () => {
    const { queue, send } = setup({ online: true });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    await queue.idle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot().items).toEqual([]);
  });

  it("replays what an earlier page load left behind (the queue survives a refresh)", async () => {
    const left: QueuedSet = {
      ...newSet("a"),
      userId: USER,
      queuedAt: 1,
      error: null,
    };
    const { queue, send } = setup({ online: true, initial: [left] });
    await queue.start(USER);
    expect(send).toHaveBeenCalledWith(left);
    expect(queue.getSnapshot().items).toEqual([]);
  });

  it("runs one replay at a time, so two triggers never send a set twice", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { queue, send, goOnline } = setup({
      online: false,
      send: async () => {
        await gate;
        return { status: "saved" };
      },
    });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    const firstRun = goOnline();
    const secondRun = queue.sync();
    release();
    await Promise.all([firstRun, secondRun]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps a refused set, shows the error, and syncs it on Try again", async () => {
    const send = vi
      .fn<(item: QueuedSet) => Promise<SyncOutcome>>()
      .mockResolvedValueOnce({
        status: "error",
        message: "Start a workout before logging sets for this exercise.",
      })
      .mockResolvedValueOnce({ status: "saved" });
    const { queue } = setup({ online: true, send });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    await queue.idle();

    expect(queue.getSnapshot().items).toHaveLength(1);
    expect(queue.getSnapshot().failure).toEqual({
      clientId: "a",
      kind: "rejected",
      message: "Start a workout before logging sets for this exercise.",
    });

    await queue.sync();
    expect(queue.getSnapshot()).toMatchObject({ items: [], failure: null });
  });

  it("keeps the set when the request fails although the browser says online", async () => {
    const { queue } = setup({
      online: true,
      send: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    await queue.idle();
    expect(queue.getSnapshot().items).toHaveLength(1);
    expect(queue.getSnapshot().failure?.kind).toBe("network");
  });

  it("removes a set only when the user discards it", async () => {
    const { queue } = setup({
      online: true,
      send: async () => ({ status: "error", message: "Refused." }),
    });
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    await queue.idle();
    await queue.discard("a");
    expect(queue.getSnapshot()).toMatchObject({ items: [], failure: null });
  });

  it("tells subscribers when the queue changes", async () => {
    const { queue } = setup({ online: false });
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    await queue.start(USER);
    await queue.enqueue(newSet("a"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    await queue.enqueue(newSet("b", SET_TWO));
    expect(listener).not.toHaveBeenCalled();
  });
});
