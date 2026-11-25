// Picks the queue's storage (D31): IndexedDB, else localStorage (IndexedDB can be missing
// or refuse to open, for example in some private windows), else memory for this page only.
import { createIndexedDbStore } from "./indexedDbStore";
import {
  createLocalStorageStore,
  createMemoryStore,
  type QueueStore,
} from "./queueStore";

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // reading localStorage itself throws when site data is blocked
  }
}

export async function openQueueStore(): Promise<QueueStore> {
  try {
    if (typeof indexedDB !== "undefined") {
      return await createIndexedDbStore(indexedDB);
    }
  } catch {
    // fall through to localStorage
  }
  const storage = localStorageOrNull();
  return storage ? createLocalStorageStore(storage) : createMemoryStore();
}
