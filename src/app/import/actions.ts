"use server";

// The import page's server action (#131): one action, two intents. "preview" reads the
// file and reports what would be saved; "save" does it. Both re-read the uploaded file,
// so the browser never sends back parsed data to trust. Next.js checks the Origin header
// of every Server Action call, which is the CSRF protection here.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { MAX_IMPORT_BYTES, parseHevyCsv } from "@/lib/import/hevy";
import type { ImportWorkout } from "@/lib/import/hevy";
import { matchExercises, type LibraryName } from "@/lib/import/match";
import { saveImport, type ImportResult } from "@/lib/import/save";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/progress/dates";

export type ImportSummary = {
  workouts: number;
  newWorkouts: number; // not saved by an earlier upload
  sets: number;
  firstDay: string;
  lastDay: string;
  skippedWarmups: number;
  skippedRows: number;
};

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "preview";
      summary: ImportSummary;
      unmatched: string[];
      moreUnmatched: number; // names beyond the ones shown; their sets are skipped
      library: LibraryName[];
    }
  | { status: "saved"; result: ImportResult };

const UNAVAILABLE = "The import can't run right now. Try again later.";
const MAX_MAPPED_NAMES = 30;
const SAVE_TIMEOUT_MS = 30_000;

type Read =
  | { ok: false; message: string }
  | {
      ok: true;
      workouts: ImportWorkout[];
      skippedWarmups: number;
      skippedRows: number;
    };

async function readFile(formData: FormData): Promise<Read> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose your Hevy export (a .csv file)." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, message: "The file must be a .csv export from Hevy." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      message: "The file is over 2 MB. Export a shorter range from Hevy.",
    };
  }
  const text = await file.text().catch(() => null);
  if (text === null)
    return { ok: false, message: "The file couldn't be read." };
  const parsed = parseHevyCsv(text);
  return parsed.ok ? { ...parsed } : { ok: false, message: parsed.error };
}

// The user's choices for names we could not match: title_0 and map_0 are a file title and
// the library exercise picked for it. A title that is not in the file, or an id that is
// not in the library, is ignored, so a forged form cannot attach sets to other exercises.
function chosenMapping(
  formData: FormData,
  fileTitles: Set<string>,
  library: LibraryName[],
): Record<string, string> {
  const ids = new Set(library.map((exercise) => exercise.id));
  const chosen = Array.from(
    { length: MAX_MAPPED_NAMES },
    (_, index) => index,
  ).flatMap((index): [string, string][] => {
    const title = formData.get(`title_${index}`);
    const id = formData.get(`map_${index}`);
    return typeof title === "string" &&
      typeof id === "string" &&
      fileTitles.has(title) &&
      ids.has(id)
      ? [[title, id]]
      : [];
  });
  // fromEntries defines own properties, so a title like "__proto__" is just a key.
  return Object.fromEntries(chosen);
}

export async function importWorkouts(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  // Outside try/catch, so a signed-out user is still redirected to sign in.
  const user = await requireUser();

  const read = await readFile(formData);
  if (!read.ok) return { status: "error", message: read.message };
  const { workouts } = read;

  try {
    const library = await prisma.exercise.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const titles = workouts.flatMap((workout) =>
      workout.sets.map((set) => set.exerciseTitle),
    );
    const { matched, unmatched } = matchExercises(titles, library);

    if (formData.get("intent") === "save") {
      const mapping = {
        ...chosenMapping(formData, new Set(unmatched), library),
        ...matched,
      };
      // A large file can take longer than Prisma's default 5 seconds.
      const result = await prisma.$transaction(
        (tx) => saveImport(tx, user.id, workouts, mapping),
        { timeout: SAVE_TIMEOUT_MS },
      );
      revalidatePath("/progress");
      return { status: "saved", result };
    }

    const existing = await prisma.workout.findMany({
      where: {
        userId: user.id,
        importKey: { in: workouts.map((workout) => workout.key) },
      },
      select: { importKey: true },
    });
    const days = workouts.map((workout) => dayKey(workout.startedAt)).sort();
    return {
      status: "preview",
      summary: {
        workouts: workouts.length,
        newWorkouts: workouts.length - existing.length,
        sets: workouts.reduce((total, w) => total + w.sets.length, 0),
        firstDay: days[0],
        lastDay: days[days.length - 1],
        skippedWarmups: read.skippedWarmups,
        skippedRows: read.skippedRows,
      },
      unmatched: unmatched.slice(0, MAX_MAPPED_NAMES),
      moreUnmatched: Math.max(0, unmatched.length - MAX_MAPPED_NAMES),
      library,
    };
  } catch (error) {
    // The user sees a plain message; the log keeps the cause. Never log file contents.
    console.error("[import] failed", { userId: user.id, error });
    return { status: "error", message: UNAVAILABLE };
  }
}
