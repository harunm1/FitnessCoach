// Which Workout.source values mean "logged by hand after the fact" (D49, #194): a run from
// the Progress page (D27) or a strength workout from Log a past workout. Neither has a clock
// time, only a day, and both count toward streaks like a live session.
import { MANUAL_RUN_SOURCE } from "@/lib/progress/runLimits";

export const MANUAL_STRENGTH_SOURCE = "manual-strength";

// A day-only workout is stored at 17:00 UTC: noon in Toronto in winter, 1 p.m. in summer,
// the same calendar day either way. The same hour as a run logged by hand.
export const MANUAL_STRENGTH_STORED_HOUR_UTC = "T17:00:00Z";

export function isManualSource(source: string): boolean {
  return source === MANUAL_RUN_SOURCE || source === MANUAL_STRENGTH_SOURCE;
}
