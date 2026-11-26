// The program templates (D38), loaded from src/data/programTemplates and parsed by
// their schema. A file that fails the schema throws on import, so the integrity test
// (templates.test.ts) fails before a broken template can reach a user.
import fullBody3 from "@/data/programTemplates/full-body-3-beginner.json";
import upperLower4 from "@/data/programTemplates/upper-lower-4.json";
import pushPullLegs6 from "@/data/programTemplates/push-pull-legs-6.json";
import hypertrophy3 from "@/data/programTemplates/hypertrophy-split-3.json";
import { templateSchema, type ProgramTemplate } from "./templateSchema";

const SOURCES: unknown[] = [
  fullBody3,
  upperLower4,
  pushPullLegs6,
  hypertrophy3,
];

export const PROGRAM_TEMPLATES: readonly ProgramTemplate[] = SOURCES.map(
  (source) => templateSchema.parse(source),
);

const BY_ID = new Map(PROGRAM_TEMPLATES.map((t) => [t.id, t]));

export const getTemplate = (id: string): ProgramTemplate | undefined =>
  BY_ID.get(id);
