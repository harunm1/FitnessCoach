import { dayKey } from "@/lib/progress/dates";

// The three kinds of export (D33). The Prisma enum `ExportKind` has the same values.
export const EXPORT_KINDS = [
  "WORKOUT_CSV",
  "COACH_CSV",
  "MONTHLY_REPORT",
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

const CSV_TYPE = "text/csv; charset=utf-8";

const KINDS: Record<
  ExportKind,
  { slug: string; extension: string; contentType: string; label: string }
> = {
  WORKOUT_CSV: {
    slug: "workouts",
    extension: "csv",
    contentType: CSV_TYPE,
    label: "Workout history (CSV)",
  },
  COACH_CSV: {
    slug: "coach-chat",
    extension: "csv",
    contentType: CSV_TYPE,
    label: "Coach conversations (CSV)",
  },
  MONTHLY_REPORT: {
    slug: "monthly-report",
    extension: "pdf",
    contentType: "application/pdf",
    label: "Monthly progress report (PDF)",
  },
};

export const exportLabel = (kind: ExportKind) => KINDS[kind].label;
export const exportContentType = (kind: ExportKind) => KINDS[kind].contentType;

// A name built from the kind and the Toronto day, never from anything the user typed.
export function exportFileName(kind: ExportKind, createdAt: Date): string {
  const { slug, extension } = KINDS[kind];
  return `fitnesscoach-${slug}-${dayKey(createdAt)}.${extension}`;
}

// A random name in the user's own folder, so keys neither clash nor can be guessed.
export function exportKey(userId: string, kind: ExportKind, id: string) {
  return `exports/${userId}/${id}.${KINDS[kind].extension}`;
}

export const photoFileName = (takenAt: Date) =>
  `progress-photo-${dayKey(takenAt)}.webp`;
