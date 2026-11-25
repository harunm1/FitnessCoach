// The one offline set queue of this browser tab (D31), wired to the real storage, the
// sync server action and the cross-tab lock. Components read it through useSessionSetQueue.
import { useSyncExternalStore } from "react";
import { syncQueuedSet } from "@/app/session/syncSetAction";
import { openQueueStore } from "./openStore";
import { createSetQueue, type QueueSnapshot } from "./setQueue";
import { withQueueLock } from "./webLock";

const syncedListeners = new Set<() => void>();

export const sessionSetQueue = createSetQueue({
  openStore: openQueueStore,
  // Only the set's own fields go to the server; it knows the user from the session.
  send: (item) =>
    syncQueuedSet({
      clientId: item.clientId,
      workoutId: item.workoutId,
      exerciseId: item.exerciseId,
      setNumber: item.setNumber,
      reps: item.reps,
      weightKg: item.weightKg,
    }),
  isOnline: () => typeof navigator === "undefined" || navigator.onLine,
  withLock: withQueueLock,
  onSynced: () => syncedListeners.forEach((listener) => listener()),
});

// Called after a replay saved at least one set, to refresh the server-rendered page.
export function onSessionSetsSynced(listener: () => void): () => void {
  syncedListeners.add(listener);
  return () => {
    syncedListeners.delete(listener);
  };
}

// The server never has queued sets; the browser fills them in after hydration.
const SERVER_SNAPSHOT: QueueSnapshot = {
  items: [],
  online: true,
  syncing: false,
  justSynced: false,
  failure: null,
};

export function useSessionSetQueue(): QueueSnapshot {
  return useSyncExternalStore(
    sessionSetQueue.subscribe,
    sessionSetQueue.getSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
