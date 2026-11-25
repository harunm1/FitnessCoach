// The offline set queue the session view talks to (D31): keeps sets on the device, replays
// them when online, and publishes a snapshot for React's useSyncExternalStore. Only one
// replay runs at a time; a trigger during a run asks for one more run after it.
import type { QueueStore } from "./queueStore";
import { oldestFirst, replayQueue, type SendQueuedSet } from "./replay";
import type { QueuedSet, SyncFailure } from "./types";

export type NewQueuedSet = Omit<QueuedSet, "userId" | "queuedAt" | "error">;

export type QueueSnapshot = {
  items: QueuedSet[]; // this user's waiting sets, oldest first
  online: boolean;
  syncing: boolean;
  justSynced: boolean; // the last replay sent everything it had
  failure: SyncFailure | null;
};

export type SetQueueOptions = {
  openStore: () => Promise<QueueStore>;
  send: SendQueuedSet;
  isOnline: () => boolean;
  now?: () => number;
  onSynced?: (count: number) => void;
  // Runs a replay under a lock shared by every tab (Web Locks); in-tab only by default.
  withLock?: <T>(run: () => Promise<T>) => Promise<T>;
  // Wait before trying again after a request got no answer (the `online` event alone
  // misses a weak signal, where the browser still reports online).
  retryDelayMs?: number;
};

const DEFAULT_RETRY_DELAY_MS = 15_000;

export function createSetQueue(options: SetQueueOptions) {
  const now = options.now ?? Date.now;
  const withLock = options.withLock ?? ((run) => run());
  const listeners = new Set<() => void>();
  let storePromise: Promise<QueueStore> | null = null;
  let userId: string | null = null;
  let running: Promise<void> | null = null;
  let runAgain = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  let snapshot: QueueSnapshot = {
    items: [],
    online: options.isOnline(),
    syncing: false,
    justSynced: false,
    failure: null,
  };

  const store = () => (storePromise ??= options.openStore());

  function update(change: Partial<QueueSnapshot>) {
    snapshot = { ...snapshot, ...change };
    listeners.forEach((listener) => listener());
  }

  async function reloadItems() {
    const all = await (await store()).all();
    update({
      items: oldestFirst(all.filter((item) => item.userId === userId)),
    });
  }

  async function replayOnce(owner: string) {
    await reloadItems();
    if (snapshot.items.length === 0) return;
    update({ justSynced: false });
    const opened = await store();
    const result = await withLock(() =>
      replayQueue(opened, owner, options.send),
    );
    await reloadItems();
    update({
      failure: result.failure,
      justSynced: result.failure === null && snapshot.items.length === 0,
    });
    if (result.synced > 0) options.onSynced?.(result.synced);
    // A refused set waits for the user; a set that got no answer is tried again later.
    if (result.failure?.kind === "network") {
      retryTimer = setTimeout(() => void sync(), retryDelayMs);
    }
  }

  async function replayUntilSettled(owner: string): Promise<void> {
    runAgain = false;
    await replayOnce(owner);
    if (runAgain && snapshot.failure === null) return replayUntilSettled(owner);
  }

  function sync(): Promise<void> {
    const owner = userId;
    if (!owner || !options.isOnline()) return Promise.resolve();
    if (running) {
      runAgain = true;
      return running;
    }
    clearTimeout(retryTimer);
    update({ syncing: true });
    running = (async () => {
      try {
        await replayUntilSettled(owner);
      } catch (error) {
        // Storage itself failed; the sets stay where they are. Never rejects, so callers
        // can start a sync without waiting for it.
        const message =
          error instanceof Error ? error.message : "Could not read saved sets.";
        update({ failure: { clientId: "", kind: "network", message } });
      } finally {
        running = null;
        update({ syncing: false });
      }
    })();
    return running;
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    async start(user: string) {
      userId = user;
      await reloadItems();
      await sync();
    },
    // Resolves once the set is stored on the device; sending it starts in the background,
    // so a slow or dead connection never holds up logging the next set.
    async enqueue(set: NewQueuedSet) {
      if (!userId) throw new Error("The set queue has not started.");
      await (
        await store()
      ).put({ ...set, userId, queuedAt: now(), error: null });
      update({ justSynced: false });
      await reloadItems();
      void sync();
    },
    sync,
    // Waits for a replay in progress, if any (tests, and the Try again button).
    idle: (): Promise<void> => running ?? Promise.resolve(),
    async setOnline(online: boolean) {
      update({ online });
      if (online) await sync();
    },
    async discard(clientId: string) {
      await (await store()).remove(clientId);
      await reloadItems();
      if (snapshot.failure?.clientId === clientId) update({ failure: null });
    },
  };
}

export type SetQueue = ReturnType<typeof createSetQueue>;
