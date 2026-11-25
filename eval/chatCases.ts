// Fixed chat cases for the reply checks (#142). Each is one user message with the topics
// that message raises, so a notice on any other topic counts as unrequested. The first
// is the question from the 22 November report. reachesModel is false where the code
// guardrail answers (pain reports, diet questions), so no model reply exists to check.
import type { CoachContext } from "../src/lib/coach/chat";
import type { Topic } from "./chatChecks";

export type ChatCase = {
  id: string;
  message: string;
  raises: Topic[];
  detail?: boolean;
  reachesModel: boolean;
  context: CoachContext;
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

export const CHAT_CASES: ChatCase[] = [
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
