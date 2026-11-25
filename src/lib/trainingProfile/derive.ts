// The training profile (D36): everything the app knows about how the user trains, derived from
// finished workouts, imported or live. Pure; the loader reads the rows.
import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";
import { experienceLevel } from "./experience";
import {
  activeWeeks,
  monthsBetween,
  usualHour,
  workoutsPerWeek,
} from "./schedule";
import type { HistorySet, TrainingProfile } from "./types";
import { ACTIVE_WEEKS_WINDOW, RECENT_WEEKS, weeksAgo } from "./windows";
import { workingWeights } from "./workingWeights";

// A piece of equipment counts once the user used it on this many recent sets.
export const MIN_SETS_FOR_EQUIPMENT = 2;

function recentEquipment(sets: HistorySet[], now: Date): string[] {
  const since = weeksAgo(RECENT_WEEKS, now);
  const counts = sets
    .filter((set) => set.equipment !== null && set.startedAt >= since)
    .reduce(
      (byName, set) =>
        byName.set(
          set.equipment as string,
          (byName.get(set.equipment as string) ?? 0) + 1,
        ),
      new Map<string, number>(),
    );
  return [...counts]
    .filter(([, count]) => count >= MIN_SETS_FOR_EQUIPMENT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

export function deriveTrainingProfile(
  starts: Date[],
  sets: HistorySet[],
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): TrainingProfile {
  const ordered = [...starts].sort((a, b) => a.getTime() - b.getTime());
  const first = ordered[0] ?? null;
  const perWeek = workoutsPerWeek(ordered, now);
  return {
    workoutCount: ordered.length,
    trainingSince: first,
    workoutsPerWeek: perWeek,
    usualHour: usualHour(ordered, now, timeZone),
    level: first
      ? experienceLevel({
          monthsSinceFirst: monthsBetween(first, now),
          activeWeeksOf26: activeWeeks(
            ordered,
            now,
            ACTIVE_WEEKS_WINDOW,
            timeZone,
          ),
          perWeekRecent: perWeek,
        })
      : "BEGINNER",
    equipment: recentEquipment(sets, now),
    workingWeights: workingWeights(sets, now),
  };
}
