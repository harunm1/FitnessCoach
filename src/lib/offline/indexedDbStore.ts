// The offline set queue in IndexedDB (D31): one object store keyed by clientId, so a put
// of the same set attempt replaces it. Checked in the browser by tests/e2e/offline-sync.
import type { QueueStore } from "./queueStore";
import type { QueuedSet } from "./types";

const DATABASE_NAME = "fitnesscoach-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "queuedSets";

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener("upgradeneeded", () => {
    request.result.createObjectStore(STORE_NAME, { keyPath: "clientId" });
  });
  return settle(request);
}

export async function createIndexedDbStore(
  factory: IDBFactory,
): Promise<QueueStore> {
  const database = await openDatabase(factory);
  const objectStore = (mode: IDBTransactionMode) =>
    database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  return {
    all: () =>
      settle(objectStore("readonly").getAll() as IDBRequest<QueuedSet[]>),
    put: async (item) => {
      await settle(objectStore("readwrite").put(item));
    },
    remove: async (clientId) => {
      await settle(objectStore("readwrite").delete(clientId));
    },
  };
}
