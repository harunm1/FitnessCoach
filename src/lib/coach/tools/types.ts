// What a coach tool returns (D43): its name, the period it covers, and a few short lines in
// the user's units. Plain data built in code from the signed-in user's rows; never the rows.
export type ToolName =
  | "getTrainingProfile"
  | "getRecentWorkouts"
  | "getExerciseHistory"
  | "getBodyWeightTrend";

export type ToolResult = {
  name: ToolName;
  period: string; // "last 90 days (28 Aug 2026 to 26 Nov 2026)"
  lines: string[];
};
