// Runs a queue replay under one lock for every tab of the app (Web Locks API, Baseline
// since March 2022 on MDN), so two open tabs never send the same queue at once. Where the
// API is missing the replay just runs; the server's clientId check keeps it safe.
const LOCK_NAME = "fitnesscoach-set-queue";

export async function withQueueLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) return run();
  return await navigator.locks.request(LOCK_NAME, run);
}
