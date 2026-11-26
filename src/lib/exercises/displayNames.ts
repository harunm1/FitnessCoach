// Names we show where the dataset's name misleads (#193). The id never changes, so plans,
// logs and history keep pointing at the same row; only the stored `name` is replaced
// when the exercise library is seeded.
export const DISPLAY_NAME_BY_ID: Readonly<Record<string, string>> = {
  // The dataset's name for a glute bridge; a hip thrust is a different lift
  // (Barbell_Hip_Thrust is its own row).
  Butt_Lift_Bridge: "Glute Bridge",
};

export const displayNameFor = (id: string, datasetName: string): string =>
  Object.hasOwn(DISPLAY_NAME_BY_ID, id) ? DISPLAY_NAME_BY_ID[id] : datasetName;
