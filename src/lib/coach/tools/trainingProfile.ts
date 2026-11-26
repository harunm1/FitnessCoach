// getTrainingProfile and getExerciseHistory (D43): the D36 training profile, computed once per
// turn, as two tool results. The wording is the D36 summary's, so Progress and the coach agree.
import type { TrainingProfile } from "@/lib/trainingProfile/types";
import { coachSummaryLines } from "@/lib/trainingProfile/summary";
import { RECENT_WEEKS } from "@/lib/trainingProfile/windows";
import type { WeightUnit } from "@/lib/units/convert";
import { lastWeeks } from "./period";
import type { ToolResult } from "./types";

export function profileResults(
  profile: TrainingProfile,
  unit: WeightUnit,
  now: Date,
): [ToolResult, ToolResult] {
  const [headline, ...lifts] = coachSummaryLines(profile, unit);
  return [
    {
      name: "getTrainingProfile",
      period: `every finished workout, imported or logged; the weekly rate is over the last ${RECENT_WEEKS} weeks`,
      lines:
        headline === undefined
          ? ["No finished workouts yet."]
          : [`Finished workouts, all time: ${profile.workoutCount}.`, headline],
    },
    {
      name: "getExerciseHistory",
      period: lastWeeks(RECENT_WEEKS, now),
      lines: lifts.length ? lifts : ["No weighted sets in this period."],
    },
  ];
}
