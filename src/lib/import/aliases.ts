// Hevy exercise names that differ from the library by more than spelling (live feedback
// 24 Nov, item 9; design in docs/IMPORT_FORMATS.md). Each target is an exact library name,
// checked against free-exercise-db dist/exercises.json fetched 25 Nov 2026 (876 exercises). A
// target the library does not hold leaves the title unmatched, so the user maps it by hand.
// Left out on purpose (verifier, 25 Nov): "Hip Thrust (Smith Machine)" (the library's Smith Machine
// Hip Raise trains the abs), "Box Jump" (the library one is repeated jumps) and "Pull Up
// (Assisted)" (Hevy's weight is the help, not a load). Only close equivalents are listed: a wrong match writes sets to the wrong exercise.
// The keys are compared through matchKey, so case, hyphens and plurals do not matter.
export const ALIAS_TARGETS: Record<string, string> = {
  // Names from the first matcher (#131, 22 Nov 2026).
  "Bench Press (Barbell)": "Barbell Bench Press - Medium Grip",
  "Overhead Press (Barbell)": "Barbell Shoulder Press",
  "Bent Over Row (Barbell)": "Bent Over Barbell Row",
  "Seated Cable Row": "Seated Cable Rows",

  // Chest, shoulders, back.
  "Incline Bench Press (Dumbbell)": "Incline Dumbbell Press",
  "Chest Fly (Dumbbell)": "Dumbbell Flyes",
  "Chest Press (Machine)": "Leverage Chest Press",
  "Low Cable Fly Crossovers": "Low Cable Crossover",
  "Lateral Raise (Dumbbell)": "Side Lateral Raise",
  "Front Raise (Cable)": "Front Cable Raise",
  "Seated Overhead Press (Dumbbell)": "Seated Dumbbell Press",
  "Chest Supported Reverse Fly (Dumbbell)": "Reverse Flyes",
  "Rear Delt Reverse Fly (Machine)": "Reverse Machine Flyes",
  "Lat Pulldown (Cable)": "Wide-Grip Lat Pulldown",
  "Straight Arm Lat Pulldown (Cable)": "Straight-Arm Pulldown",
  "Chest Supported Incline Row (Dumbbell)": "Dumbbell Incline Row",
  "Dumbbell Row": "One-Arm Dumbbell Row",
  "Seated Cable Row - V Grip (Cable)": "Seated Cable Rows",
  "Seated Cable Row - Bar Grip": "Seated Cable Rows",

  // Arms.
  "Bicep Curl (Barbell)": "Barbell Curl",
  "Bicep Curl (Cable)": "Standing Biceps Cable Curl",
  "EZ Bar Biceps Curl": "EZ-Bar Curl",
  "Hammer Curl (Dumbbell)": "Hammer Curls",
  "Hammer Curl (Cable)": "Cable Hammer Curls - Rope Attachment",
  "Seated Incline Curl (Dumbbell)": "Incline Dumbbell Curl",
  "Triceps Rope Pushdown": "Triceps Pushdown - Rope Attachment",
  "Overhead Triceps Extension (Cable)": "Cable Rope Overhead Triceps Extension",
  "Overhead Triceps Extension (Dumbbell Seated)": "Seated Triceps Press",
  "Skullcrusher (Dumbbell)": "Lying Dumbbell Tricep Extension",
  "Skullcrusher (Barbell)": "EZ-Bar Skullcrusher",
  "Triceps Dip (Weighted)": "Dips - Triceps Version",

  // Legs, glutes, core.
  "Front Squat": "Front Barbell Squat",
  "Reverse Lunge (Dumbbell)": "Dumbbell Rear Lunge",
  "Jump Squat": "Freehand Jump Squat",
  "Lying Leg Raise": "Flat Bench Lying Leg Raise",
  "Cable Woodchopper": "Standing Cable Wood Chop",
  "Cable Core Pallof Press": "Pallof Press",
};
