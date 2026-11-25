// Matches exercise names from another app to the library (#131): exact (case and spacing
// ignored), then Hevy's "Name (Equipment)" as "Equipment Name" or as the bare name, then a
// short alias list. A name that matches more than one library exercise, or none, is left
// for the user to map or skip. The bare-name step takes the equipment off ("Face Pull
// (Cable)" finds "Face Pull"), so it can pair "Curl (Cable)" with a plain "Curl" when that is
// the only one: the preview lists nothing for it, so docs/IMPORT_FORMATS.md names it as a limit.
export type LibraryName = { id: string; name: string };

// Hevy names that differ from the library beyond the equipment form. Each target is an
// exact library name (checked against eval/fixtures-library.json, 22 Nov 2026); a target
// the library does not hold just leaves the title unmatched.
const ALIASES: Record<string, string> = {
  "bench press (barbell)": "Barbell Bench Press - Medium Grip",
  "overhead press (barbell)": "Barbell Shoulder Press",
  "bent over row (barbell)": "Bent Over Barbell Row",
  "seated cable row": "Seated Cable Rows",
  "pull up": "Pullups",
  "pull-up": "Pullups",
};

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

// "Squat (Barbell)" gives { base: "squat", equipment: "barbell" }.
function splitEquipment(title: string) {
  // Accepts "Squat (Barbell)"; rejects "Squat" and "(Barbell)".
  const found = /^(.+?) \(([^)]+)\)$/.exec(normalizeTitle(title));
  return found ? { base: found[1], equipment: found[2] } : null;
}

export function matchExercises(titles: string[], library: LibraryName[]) {
  const byName = new Map<string, string[]>();
  library.forEach(({ id, name }) => {
    const key = normalizeTitle(name);
    byName.set(key, [...(byName.get(key) ?? []), id]);
  });
  const unique = (name: string) => {
    const ids = byName.get(normalizeTitle(name)) ?? [];
    return ids.length === 1 ? ids[0] : null;
  };

  const found: [string, string][] = [];
  const unmatched: string[] = [];
  [...new Set(titles)].forEach((title) => {
    const split = splitEquipment(title);
    const candidates = [
      title,
      ...(split ? [`${split.equipment} ${split.base}`, split.base] : []),
      Object.hasOwn(ALIASES, normalizeTitle(title))
        ? ALIASES[normalizeTitle(title)]
        : "",
    ].filter((name) => name !== "");
    const id = candidates
      .map(unique)
      .find((found): found is string => found !== null);
    if (id) found.push([title, id]);
    else unmatched.push(title);
  });
  // fromEntries defines own properties, so a title like "__proto__" is just a key.
  return { matched: Object.fromEntries(found), unmatched };
}
