// The pain stop rule (#92) over saved and queued sets alike (D31), with the same reading
// the server uses: a missing score counts as 0.
import { painTrafficLight } from "@/lib/coach/painTrafficLight";

type ScoredSet = {
  setNumber: number;
  painDuringSession: number | null;
  painNextMorning: number | null;
};

export function firstStoppedSet<T extends ScoredSet>(sets: T[]): T | null {
  return (
    sets.find(
      (set) =>
        painTrafficLight(set.painDuringSession ?? 0, set.painNextMorning ?? 0)
          .state === "stop",
    ) ?? null
  );
}
