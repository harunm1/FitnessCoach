import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";

type LabelledPhoto = { takenAt: Date; weightKg: number | null };

// The same date style the gallery and the progress strip already use.
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFAULT_TIME_ZONE,
  dateStyle: "medium",
});

// "Progress photo from Nov. 12, 2026, 81.5 kg": the alt text, so a screen
// reader hears the date and, when it was logged, the weight.
export function photoAlt({ takenAt, weightKg }: LabelledPhoto): string {
  const date = `Progress photo from ${dateFormat.format(takenAt)}`;
  return weightKg === null ? date : `${date}, ${weightKg} kg`;
}

// "Nov. 12, 2026 · 81.5 kg": the visible caption and the dialog title.
export function photoCaption({ takenAt, weightKg }: LabelledPhoto): string {
  const date = dateFormat.format(takenAt);
  return weightKg === null ? date : `${date} · ${weightKg} kg`;
}
