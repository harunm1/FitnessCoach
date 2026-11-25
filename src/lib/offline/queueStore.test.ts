// @vitest-environment jsdom
// Stores behind the offline set queue (D31). The localStorage store stands in when
// IndexedDB cannot open; reopening it is what a page refresh does.
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalStorageStore, createMemoryStore } from "./queueStore";
import type { QueuedSet } from "./types";

const STORAGE_KEY = "fitnesscoach.setQueue.v1";
const WORKOUT_ID = 7;
const REPS = 8;
const EDITED_REPS = 9;
const SET_ONE = 1;
const QUEUED_AT = 1_000;

const item: QueuedSet = {
  clientId: "a",
  userId: "user-1",
  workoutId: WORKOUT_ID,
  exerciseId: "press",
  setNumber: SET_ONE,
  reps: REPS,
  weightKg: null,
  queuedAt: QUEUED_AT,
  error: null,
};

describe.each([
  ["memory", () => createMemoryStore()],
  ["localStorage", () => createLocalStorageStore(window.localStorage)],
])("%s store", (_name, open) => {
  beforeEach(() => window.localStorage.clear());

  it("adds, lists and removes items", async () => {
    const store = open();
    await store.put(item);
    expect(await store.all()).toEqual([item]);
    await store.remove(item.clientId);
    expect(await store.all()).toEqual([]);
  });

  it("keeps one item per clientId, so a double tap stores one set", async () => {
    const store = open();
    await store.put(item);
    await store.put({ ...item, reps: EDITED_REPS });
    expect(await store.all()).toEqual([{ ...item, reps: EDITED_REPS }]);
  });
});

describe("localStorage store", () => {
  beforeEach(() => window.localStorage.clear());

  it("survives a refresh: a new store on the same storage sees the items", async () => {
    await createLocalStorageStore(window.localStorage).put(item);
    expect(await createLocalStorageStore(window.localStorage).all()).toEqual([
      item,
    ]);
  });

  it("reads a corrupted entry as an empty queue instead of throwing", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(await createLocalStorageStore(window.localStorage).all()).toEqual(
      [],
    );
  });
});
