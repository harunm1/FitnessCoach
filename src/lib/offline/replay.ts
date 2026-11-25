// Sends one user's queued sets oldest first, one at a time (D31). An item leaves the store
// only when the server confirms it; the first failure stops the run so a later set never
// overtakes an earlier one.
import type { QueueStore } from "./queueStore";
import type { QueuedSet, SyncFailure, SyncOutcome } from "./types";

export type SendQueuedSet = (item: QueuedSet) => Promise<SyncOutcome>;

export type ReplayResult = { synced: number; failure: SyncFailure | null };

export function oldestFirst(items: QueuedSet[]): QueuedSet[] {
  return [...items].sort(
    (a, b) =>
      a.queuedAt - b.queuedAt ||
      a.setNumber - b.setNumber ||
      a.clientId.localeCompare(b.clientId),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not reach the server.";
}

async function sendOne(
  store: QueueStore,
  item: QueuedSet,
  send: SendQueuedSet,
): Promise<SyncFailure | null> {
  let outcome: SyncOutcome;
  try {
    outcome = await send(item);
  } catch (error) {
    // No answer (offline, dropped connection): the server may or may not have it, and
    // the same clientId makes the next try safe either way.
    return {
      clientId: item.clientId,
      kind: "network",
      message: errorMessage(error),
    };
  }
  if (outcome.status === "error") {
    await store.put({ ...item, error: outcome.message });
    return {
      clientId: item.clientId,
      kind: "rejected",
      message: outcome.message,
    };
  }
  await store.remove(item.clientId);
  return null;
}

// Sequential on purpose: set N+1 is only valid on the server after set N.
async function sendInOrder(
  store: QueueStore,
  items: QueuedSet[],
  send: SendQueuedSet,
  synced = 0,
): Promise<ReplayResult> {
  const [next, ...rest] = items;
  if (!next) return { synced, failure: null };
  const failure = await sendOne(store, next, send);
  if (failure) return { synced, failure };
  return sendInOrder(store, rest, send, synced + 1);
}

export async function replayQueue(
  store: QueueStore,
  userId: string,
  send: SendQueuedSet,
): Promise<ReplayResult> {
  const mine = oldestFirst(
    (await store.all()).filter((item) => item.userId === userId),
  );
  return sendInOrder(store, mine, send);
}
