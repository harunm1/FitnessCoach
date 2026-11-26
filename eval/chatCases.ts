// Fixed chat cases for the reply checks (#142). Each is one user message with the topics
// that message raises, so a notice on any other topic counts as unrequested. The first
// is the 25 November message the coach could not answer (D43), the second the question from
// the 22 November report. reachesModel is false where the code
// guardrail answers (pain reports, diet questions), so no model reply exists to check.
import type { CoachContext } from "../src/lib/coach/chat";
import { bodyWeightTrendResult } from "../src/lib/coach/tools/bodyWeightTrend";
import { recentWorkoutsResult } from "../src/lib/coach/tools/recentWorkouts";
import type { Topic } from "./chatChecks";

export type ChatCase = {
  id: string;
  message: string;
  raises: Topic[];
  detail?: boolean;
  reachesModel: boolean;
  context: CoachContext;
  mustCite?: string[]; // numbers the reply must give (D43)
};

// The quiz answers in #142: lose body fat, both, trained for years, 3 days, all equipment.
const CONTEXT: CoachContext = {
  goal: "lose body fat",
  level: "advanced",
  daysPerWeek: 3,
  equipment: ["barbell", "dumbbell", "cable", "machine", "bench"],
  injuries: null,
  sessionLines: [
    "Bench press 3 x 8",
    "Barbell row 3 x 8",
    "Overhead press 3 x 10",
  ],
};

const modelCase = (
  id: string,
  message: string,
  extra: Partial<ChatCase> = {},
): ChatCase => ({
  id,
  message,
  raises: [],
  reachesModel: true,
  context: CONTEXT,
  ...extra,
});

// The 25 Nov 17:20 failure (D43): the same quiz answers plus the coach's tool results for a
// seeded fixture, never his account: 412 imported workouts and a 3.2 kg drop over the last
// 90 days. The results are made by the tools' own functions, so the case follows their wording.
const FIXTURE_NOW = new Date("2026-11-26T17:00:00Z");
const benchSet = { exerciseName: "Bench Press", reps: 5, weightKg: 80 };
const REVIEW_CONTEXT: CoachContext = {
  ...CONTEXT,
  toolResults: [
    recentWorkoutsResult(
      [
        { source: "hevy-import", sets: [benchSet, benchSet] },
        { source: "live", sets: [benchSet] },
      ],
      {
        count: 412,
        first: new Date("2024-03-14T22:00:00Z"),
        last: new Date("2026-11-20T23:00:00Z"),
      },
      "KG",
      FIXTURE_NOW,
    ),
    bodyWeightTrendResult(
      [
        { date: "2026-09-01", weightKg: 84.2 },
        { date: "2026-11-24", weightKg: 81 },
      ],
      "KG",
      FIXTURE_NOW,
    ),
  ],
};

export const CHAT_CASES: ChatCase[] = [
  modelCase(
    "import-weight-review",
    "review my hevy import history, and weight loss",
    { context: REVIEW_CONTEXT, mustCite: ["412", "3.2"] },
  ),
  modelCase("floor-press-swap", "Can I do floor press instead of bench today?"),
  modelCase("bench-taken", "The bench is taken. What can I do instead?"),
  modelCase("how-many-sets", "How many sets of rows do I do today?"),
  modelCase("back-cue", "Any cue to keep my lower back flat on rows?"),
  modelCase("rest-days", "How many rest days should I take between sessions?", {
    raises: ["recovery"],
  }),
  modelCase(
    "brace-detail",
    "Explain in detail how to brace and set up for the overhead press.",
    { detail: true },
  ),
  modelCase("elbow-pain", "I get a sharp pain in my elbow on the press.", {
    raises: ["pain"],
    reachesModel: false,
  }),
  modelCase("protein-intake", "How much protein should I eat?", {
    raises: ["nutrition"],
    reachesModel: false,
  }),
];
