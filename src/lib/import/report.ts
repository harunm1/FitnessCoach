// What an import left out and why (live feedback 24 Nov, item 8). The save step already knows
// the counts; this keeps them with the names that were skipped, so the result panel can say
// "868 timed sets have no reps" instead of the page silently resetting.

export const MAX_NAMES_LISTED = 10;

export type ImportReport = {
  skippedWarmups: number; // warm-up sets, never imported
  skippedTimedSets: number; // sets with no reps (a time, not a count)
  skippedNames: string[]; // exercise names with no library match that the user did not map
  moreSkippedNames: number; // names beyond the ones listed
};

export function buildImportReport(input: {
  skippedWarmups: number;
  skippedRows: number;
  unmatched: string[];
  mapping: Record<string, string>;
}): ImportReport {
  // Own keys only: a title like "constructor" must not find a method on Object.prototype.
  const dropped = input.unmatched.filter(
    (title) => !Object.hasOwn(input.mapping, title),
  );
  return {
    skippedWarmups: input.skippedWarmups,
    skippedTimedSets: input.skippedRows,
    skippedNames: dropped.slice(0, MAX_NAMES_LISTED),
    moreSkippedNames: Math.max(0, dropped.length - MAX_NAMES_LISTED),
  };
}
