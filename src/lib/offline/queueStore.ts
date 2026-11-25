// Where queued sets wait (D31). Every store keeps one item per clientId, so writing the
// same set attempt twice (a double tap) leaves one item.
import type { QueuedSet } from "./types";

export type QueueStore = {
  all(): Promise<QueuedSet[]>;
  put(item: QueuedSet): Promise<void>;
  remove(clientId: string): Promise<void>;
};

export const LOCAL_STORAGE_KEY = "fitnesscoach.setQueue.v1";

// For tests, and the last resort when the browser keeps no storage at all.
export function createMemoryStore(initial: QueuedSet[] = []): QueueStore {
  const items = new Map(initial.map((item) => [item.clientId, item]));
  return {
    all: async () => [...items.values()],
    put: async (item) => {
      items.set(item.clientId, item);
    },
    remove: async (clientId) => {
      items.delete(clientId);
    },
  };
}

function readItems(storage: Storage): QueuedSet[] {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(LOCAL_STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(parsed) ? (parsed as QueuedSet[]) : [];
  } catch {
    // A damaged entry must not stop the session page; the queue starts empty.
    return [];
  }
}

// The fallback when IndexedDB cannot open. The whole queue is one JSON entry.
export function createLocalStorageStore(storage: Storage): QueueStore {
  const write = (items: QueuedSet[]) =>
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  return {
    all: async () => readItems(storage),
    put: async (item) => {
      const others = readItems(storage).filter(
        (existing) => existing.clientId !== item.clientId,
      );
      write([...others, item]);
    },
    remove: async (clientId) => {
      write(readItems(storage).filter((item) => item.clientId !== clientId));
    },
  };
}
