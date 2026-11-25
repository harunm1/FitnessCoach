// What the monthly report says, worked out from the month's sets (D34). Pure: no database.

export type ReportSet = {
  exerciseId: string;
  exerciseName: string;
  primaryMuscles: string[];
  weightKg: number | null;
  reps: number;
};

export type MonthlyReport = {
  month: string;
  sessions: number;
  totalSets: number;
  muscles: { muscle: string; sets: number; volumeKg: number }[];
  personalBests: {
    exerciseName: string;
    weightKg: number;
    reps: number;
    previousKg: number;
  }[];
};

export type MonthlyReportInput = {
  month: string;
  sessions: number;
  sets: ReportSet[]; // the month's sets only
  priorBestKg: Record<string, number>; // heaviest weight per exercise before the month
};

const volumeOf = (set: ReportSet) => (set.weightKg ?? 0) * set.reps;

// Each primary muscle of a set gets the whole set and its whole volume.
function byMuscle(sets: ReportSet[]): MonthlyReport["muscles"] {
  const totals = sets.reduce((map, set) => {
    set.primaryMuscles.forEach((muscle) => {
      const so_far = map.get(muscle) ?? { sets: 0, volumeKg: 0 };
      map.set(muscle, {
        sets: so_far.sets + 1,
        volumeKg: so_far.volumeKg + volumeOf(set),
      });
    });
    return map;
  }, new Map<string, { sets: number; volumeKg: number }>());
  return [...totals]
    .map(([muscle, total]) => ({ muscle, ...total }))
    .sort(
      (a, b) => b.volumeKg - a.volumeKg || a.muscle.localeCompare(b.muscle),
    );
}

// A best is the month's heaviest set of an exercise when it beats every set before the month.
// With no earlier history there is nothing to beat, so a first-ever lift is not called a best.
function personalBests(
  sets: ReportSet[],
  priorBestKg: Record<string, number>,
): MonthlyReport["personalBests"] {
  const heaviest = sets.reduce((map, set) => {
    if (set.weightKg === null) return map;
    const held = map.get(set.exerciseId);
    const heavier = !held || set.weightKg > held.weightKg;
    const sameWeightMoreReps =
      held && set.weightKg === held.weightKg && set.reps > held.reps;
    if (heavier || sameWeightMoreReps) {
      map.set(set.exerciseId, {
        exerciseName: set.exerciseName,
        weightKg: set.weightKg,
        reps: set.reps,
      });
    }
    return map;
  }, new Map<string, { exerciseName: string; weightKg: number; reps: number }>());
  return [...heaviest]
    .flatMap(([exerciseId, best]) => {
      const previousKg = priorBestKg[exerciseId];
      return previousKg !== undefined && best.weightKg > previousKg
        ? [{ ...best, previousKg }]
        : [];
    })
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
  return {
    month: input.month,
    sessions: input.sessions,
    totalSets: input.sets.length,
    muscles: byMuscle(input.sets),
    personalBests: personalBests(input.sets, input.priorBestKg),
  };
}
