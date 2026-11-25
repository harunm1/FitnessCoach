// Tests for matching imported exercise names to the library (#131): exact, then equipment form and alias.
import { describe, expect, it } from "vitest";
import { matchExercises, normalizeTitle } from "./match";

const library = [
  { id: "bench", name: "Barbell Bench Press - Medium Grip" },
  { id: "dbbench", name: "Dumbbell Bench Press" },
  { id: "squat", name: "Barbell Squat" },
  { id: "facepull", name: "Face Pull" },
  { id: "pullups", name: "Pullups" },
  { id: "curl1", name: "Dumbbell Bicep Curl" },
  { id: "curl2", name: "Dumbbell Bicep Curl" },
];

describe("normalizeTitle", () => {
  it("ignores case, spacing and punctuation spacing", () => {
    expect(normalizeTitle("  Face   PULL ")).toBe("face pull");
  });
});

describe("matchExercises", () => {
  it("matches an exact name ignoring case and spacing", () => {
    const result = matchExercises(["dumbbell bench  press"], library);
    expect(result.matched["dumbbell bench  press"]).toBe("dbbench");
  });

  it("matches Hevy's 'Name (Equipment)' to the library's 'Equipment Name'", () => {
    const result = matchExercises(
      ["Squat (Barbell)", "Bench Press (Dumbbell)"],
      library,
    );
    expect(result.matched["Squat (Barbell)"]).toBe("squat");
    expect(result.matched["Bench Press (Dumbbell)"]).toBe("dbbench");
  });

  it("drops the equipment in brackets when the plain name matches", () => {
    expect(
      matchExercises(["Face Pull (Cable)"], library).matched[
        "Face Pull (Cable)"
      ],
    ).toBe("facepull");
  });

  it("uses the alias list", () => {
    const result = matchExercises(
      ["Bench Press (Barbell)", "Pull Up"],
      library,
    );
    expect(result.matched["Bench Press (Barbell)"]).toBe("bench");
    expect(result.matched["Pull Up"]).toBe("pullups");
  });

  it("lists names it cannot match, and ambiguous ones, as unmatched", () => {
    const result = matchExercises(
      ["Zercher Carry", "Dumbbell Bicep Curl"],
      library,
    );
    expect(result.unmatched).toEqual(["Zercher Carry", "Dumbbell Bicep Curl"]);
    expect(result.matched).toEqual({});
  });

  it("keeps a title like constructor or __proto__ as an ordinary name", () => {
    const result = matchExercises(["constructor", "__proto__"], library);
    expect(result.unmatched).toEqual(["constructor", "__proto__"]);
    expect(Object.keys(result.matched)).toEqual([]);
  });

  it("does not match an equipment variant the library lacks to a different exercise", () => {
    const result = matchExercises(["Bench Press (Smith Machine)"], library);
    expect(result.unmatched).toEqual(["Bench Press (Smith Machine)"]);
  });

  it("lists each title once", () => {
    const result = matchExercises(["Zercher Carry", "Zercher Carry"], library);
    expect(result.unmatched).toEqual(["Zercher Carry"]);
  });
});

// Live feedback 24 Nov, item 9: common Hevy names that missed the library. Synthetic fixtures
// built from public library names; no row of anyone's export is copied here.
describe("matchExercises, common Hevy names", () => {
  const wide = [
    { id: "pushups", name: "Pushups" },
    { id: "bench", name: "Barbell Bench Press - Medium Grip" },
    { id: "legext", name: "Leg Extensions" },
    { id: "wcrunch", name: "Weighted Crunches" },
    { id: "wpull", name: "Weighted Pull Ups" },
    { id: "dbstep", name: "Dumbbell Step Ups" },
    { id: "inclinedb", name: "Incline Dumbbell Press" },
    { id: "side", name: "Side Lateral Raise" },
    { id: "pallof", name: "Pallof Press" },
    { id: "chop", name: "Standing Cable Wood Chop" },
    { id: "frontsq", name: "Front Barbell Squat" },
    { id: "wideLat", name: "Wide-Grip Lat Pulldown" },
    { id: "ezcurl", name: "EZ-Bar Curl" },
    { id: "rows", name: "Seated Cable Rows" },
    { id: "dbrow", name: "One-Arm Dumbbell Row" },
  ];
  const find = (title: string) => matchExercises([title], wide);

  it("matches Push Up to Pushups and an exact library name as written", () => {
    expect(find("Push Up").matched["Push Up"]).toBe("pushups");
    expect(find("Barbell Bench Press - Medium Grip").matched).toEqual({
      "Barbell Bench Press - Medium Grip": "bench",
    });
  });

  it("matches plurals and a hyphen difference without an alias", () => {
    expect(find("Leg Extension (Machine)").matched).toEqual({
      "Leg Extension (Machine)": "legext",
    });
    expect(find("Dumbbell Step Up").matched["Dumbbell Step Up"]).toBe("dbstep");
  });

  it("puts a bracketed equipment first, as the library does, plural or not", () => {
    expect(find("Crunch (Weighted)").matched["Crunch (Weighted)"]).toBe(
      "wcrunch",
    );
    expect(find("Pull Up (Weighted)").matched["Pull Up (Weighted)"]).toBe(
      "wpull",
    );
  });

  it("uses the alias list for names that differ in more than spelling", () => {
    expect(
      find("Incline Bench Press (Dumbbell)").matched[
        "Incline Bench Press (Dumbbell)"
      ],
    ).toBe("inclinedb");
    expect(
      find("Lateral Raise (Dumbbell)").matched["Lateral Raise (Dumbbell)"],
    ).toBe("side");
    expect(find("Cable Woodchopper").matched["Cable Woodchopper"]).toBe("chop");
    expect(find("Front Squat").matched["Front Squat"]).toBe("frontsq");
    expect(find("Lat Pulldown (Cable)").matched["Lat Pulldown (Cable)"]).toBe(
      "wideLat",
    );
    expect(find("EZ Bar Biceps Curl").matched["EZ Bar Biceps Curl"]).toBe(
      "ezcurl",
    );
    expect(find("Dumbbell Row").matched["Dumbbell Row"]).toBe("dbrow");
  });

  it("matches both spellings of the Pallof press and the grip variants of the seated row", () => {
    expect(
      find("Cable Core Palloff Press").matched["Cable Core Palloff Press"],
    ).toBe("pallof");
    expect(
      find("Cable Core Pallof Press").matched["Cable Core Pallof Press"],
    ).toBe("pallof");
    expect(
      find("Seated Cable Row - V Grip (Cable)").matched[
        "Seated Cable Row - V Grip (Cable)"
      ],
    ).toBe("rows");
  });

  it("leaves a name it is not sure of unmatched, so the user can map it", () => {
    const result = matchExercises(["Compound Row", "Zercher Carry"], wide);
    expect(result.unmatched).toEqual(["Compound Row", "Zercher Carry"]);
  });

  it("does not let an alias point at a library exercise that is missing", () => {
    // "Incline Dumbbell Press" is the alias target; without it the title stays unmatched.
    const without = wide.filter((exercise) => exercise.id !== "inclinedb");
    expect(
      matchExercises(["Incline Bench Press (Dumbbell)"], without).unmatched,
    ).toEqual(["Incline Bench Press (Dumbbell)"]);
  });
});

describe("matchExercises, alias before the bare name", () => {
  const equipmentLibrary = [
    { id: "hammer", name: "Hammer Curls" },
    { id: "cablehammer", name: "Cable Hammer Curls - Rope Attachment" },
    { id: "pullups", name: "Pullups" },
    { id: "assisted", name: "Band Assisted Pull-Up" },
  ];

  it("keeps the equipment the alias names instead of dropping it", () => {
    const result = matchExercises(
      ["Hammer Curl (Cable)", "Pull Up (Assisted)"],
      equipmentLibrary,
    );
    expect(result.matched["Hammer Curl (Cable)"]).toBe("cablehammer");
    expect(result.matched["Pull Up (Assisted)"]).toBe("assisted");
  });
});
