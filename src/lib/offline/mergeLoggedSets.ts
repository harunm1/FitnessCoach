// One exercise's sets as the session view shows them (D31): the server's rows plus the
// sets still waiting in the offline queue. A queued set with the number of a saved one is
// an edit and is shown in its place.

export type ServerSet = {
  id: number;
  setNumber: number;
  reps: number;
  weightKg: string | null;
};

export type PendingSet = {
  clientId: string;
  setNumber: number;
  reps: number;
  weightKg: string | null;
  queuedAt: number;
  error: string | null;
};

export type SetRow = {
  key: string;
  setNumber: number;
  reps: number;
  weightKg: string | null;
  queued: boolean;
  error: string | null;
};

export type MergedSets = {
  rows: SetRow[];
  loggedCount: number;
  nextSetNumber: number;
  remaining: number;
  latestQueuedAt: number | null;
};

const serverRow = (set: ServerSet): SetRow => ({
  key: `server-${set.id}`,
  setNumber: set.setNumber,
  reps: set.reps,
  weightKg: set.weightKg,
  queued: false,
  error: null,
});

const queuedRow = (set: PendingSet): SetRow => ({
  key: `queued-${set.clientId}`,
  setNumber: set.setNumber,
  reps: set.reps,
  weightKg: set.weightKg,
  queued: true,
  error: set.error,
});

export function mergeLoggedSets(
  serverSets: ServerSet[],
  pending: PendingSet[],
  plannedSets: number,
): MergedSets {
  // Oldest first, so the newest queued value for a set number is the one kept.
  const queuedOldestFirst = [...pending].sort(
    (a, b) => a.queuedAt - b.queuedAt,
  );
  const bySetNumber = new Map<number, SetRow>([
    ...serverSets.map((set): [number, SetRow] => [
      set.setNumber,
      serverRow(set),
    ]),
    ...queuedOldestFirst.map((set): [number, SetRow] => [
      set.setNumber,
      queuedRow(set),
    ]),
  ]);
  const rows = [...bySetNumber.values()].sort(
    (a, b) => a.setNumber - b.setNumber,
  );
  const highest = rows.reduce((max, row) => Math.max(max, row.setNumber), 0);
  return {
    rows,
    loggedCount: rows.length,
    nextSetNumber: highest + 1,
    remaining: Math.max(plannedSets - rows.length, 0),
    latestQueuedAt: queuedOldestFirst.at(-1)?.queuedAt ?? null,
  };
}
