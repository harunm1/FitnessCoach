// Matches exercise names from another app to the library (#131): exact (case, hyphens,
// spacing and plurals ignored, see matchKey), then Hevy's "Name (Equipment)" as "Equipment
// Name" or as the bare name, then the alias list (aliases.ts, live feedback 24 Nov item 9).
// A name that matches more than one library exercise, or none, is left for the user to map
// or skip. The bare-name step takes the equipment off ("Face Pull (Cable)" finds "Face
// Pull"), so it can pair "Curl (Cable)" with a plain "Curl" when that is the only one: the
// preview lists nothing for it, so docs/IMPORT_FORMATS.md names it as a limit.
import { ALIAS_TARGETS } from "./aliases";
import { matchKey } from "./matchKey";

export type LibraryName = { id: string; name: string };

// A Map keyed by matchKey, so a title like "__proto__" is an ordinary key and spelling
// differences do not matter. A target the library does not hold leaves the title unmatched.
const ALIASES = new Map(
  Object.entries(ALIAS_TARGETS).map(([title, target]) => [
    matchKey(title),
    target,
  ]),
);

// Accepts any run of spaces and tabs: "Face   Pull" becomes "face pull"; a single space is kept.
// https://regex101.com/?regex=%5Cs%2B&flags=g&testString=Face%20%20%20Pull
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

// "Squat (Barbell)" gives { base: "squat", equipment: "barbell" }.
function splitEquipment(title: string) {
  // Accepts "Squat (Barbell)"; rejects "Squat" and "(Barbell)".
  // https://regex101.com/?regex=%5E(.%2B%3F)%20%5C(%5B%5E)%5D%2B)%5C)%24&testString=Squat%20(Barbell)
  const found = /^(.+?) \(([^)]+)\)$/.exec(normalizeTitle(title));
  return found ? { base: found[1], equipment: found[2] } : null;
}

// "Assisted" is the help given, not a load, so "Pull Up (Assisted)" never falls to a plain "Pull Up".
function equipmentForms({
  base,
  equipment,
}: {
  base: string;
  equipment: string;
}) {
  return equipment === "assisted" ? [] : [`${equipment} ${base}`, base];
}

export function matchExercises(titles: string[], library: LibraryName[]) {
  const byKey = new Map<string, string[]>();
  library.forEach(({ id, name }) => {
    const key = matchKey(name);
    byKey.set(key, [...(byKey.get(key) ?? []), id]);
  });
  // The exact name first (case and spacing only), so a library name always finds itself even
  // when another name shares its spelling key; the key is the fallback.
  const byExact = new Map<string, string[]>();
  library.forEach(({ id, name }) => {
    const exact = normalizeTitle(name);
    byExact.set(exact, [...(byExact.get(exact) ?? []), id]);
  });
  const unique = (name: string) => {
    const exactIds = byExact.get(normalizeTitle(name)) ?? [];
    if (exactIds.length > 0) return exactIds.length === 1 ? exactIds[0] : null;
    const ids = byKey.get(matchKey(name)) ?? [];
    return ids.length === 1 ? ids[0] : null;
  };

  const found: [string, string][] = [];
  const unmatched: string[] = [];
  [...new Set(titles)].forEach((title) => {
    const split = splitEquipment(title);
    // The alias comes before the equipment forms, so "Hammer Curl (Cable)" finds the cable
    // exercise instead of falling to the plain "Hammer Curls".
    const candidates = [
      title,
      ALIASES.get(matchKey(title)) ?? "",
      ...(split ? equipmentForms(split) : []),
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
