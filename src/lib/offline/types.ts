// Shapes shared by the offline set queue (D31) on the device and the sync action on the
// server. A queued set is what the form captured; the server re-validates all of it.

export type QueuedSet = {
  clientId: string; // crypto.randomUUID(), one per set attempt: the idempotency key
  userId: string; // who logged it, so another account on the browser never sends it
  workoutId: number; // the open workout it belongs to
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: string | null; // as typed; null when left empty
  queuedAt: number; // device time in ms, for oldest-first replay
  error: string | null; // the server's reason when it refused the set
};

export type SyncOutcome =
  | { status: "saved" }
  | { status: "duplicate" } // the server already had this clientId: nothing written
  | { status: "error"; message: string };

export type SyncFailure = {
  clientId: string;
  kind: "rejected" | "network";
  message: string;
};
