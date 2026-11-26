// The chosen unit shows everywhere a weight or a distance is typed or read (D30). Stored
// values are kilograms and kilometres; these tests give pounds and miles to each component
// and check the label, the converted number and the unit posted back with the form.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/account/unit-actions", () => ({ setWeightUnit: vi.fn() }));
vi.mock("@/app/session/actions", () => ({
  logSet: vi.fn(),
  saveRunMetrics: vi.fn(),
}));
vi.mock("@/app/progress/weight/actions", () => ({ logBodyWeight: vi.fn() }));
vi.mock("@/app/progress/run/actions", () => ({ logRun: vi.fn() }));
vi.mock("@/app/progress/photos/actions", () => ({
  uploadProgressPhoto: vi.fn(),
  deleteProgressPhoto: vi.fn(),
}));
import { ImportPreview } from "./import/ImportPreview";
import { PhotoUploadForm } from "./photos/PhotoUploadForm";
import BodyWeightSection from "./progress/BodyWeightSection";
import DayDetails from "./progress/DayDetails";
import RunLogSection from "./progress/RunLogSection";
import RunMetricsForm from "./RunMetricsForm";
import { photoAlt, photoCaption } from "@/lib/photos/label";
import { weightPlaceholder } from "@/lib/workout/weightPlaceholder";

const LB_MI = { weightUnit: "LB", distanceUnit: "MI" } as const;
const KG_KM = { weightUnit: "KG", distanceUnit: "KM" } as const;

describe("session logging", () => {
  it("asks for the run distance in miles and shows the saved km converted", () => {
    const html = renderToStaticMarkup(
      <RunMetricsForm
        distanceKm="8.05"
        durationSeconds={1800}
        distanceUnit="MI"
      />,
    );
    expect(html).toContain("Distance (mi)");
    expect(html).toContain('value="5.002"');
    expect(html).toMatch(/name="distanceUnit"[^>]*value="MI"/);
  });

  it("hints in the chosen unit", () => {
    expect(weightPlaceholder("barbell", "LB")).toBe("Load in lb");
    expect(weightPlaceholder("bands", "LB")).toBe("Optional lb");
    expect(weightPlaceholder("body only", "LB")).toBe("Bodyweight");
    expect(weightPlaceholder("barbell")).toBe("Load in kg");
  });
});

describe("history", () => {
  const workouts = [
    {
      id: 1,
      name: "Push",
      startTime: "6:00 PM",
      minutes: 50,
      exercises: [
        {
          name: "Bench Press",
          sets: [
            { reps: 5, weightKg: 61.23 },
            { reps: 5, weightKg: null },
          ],
        },
      ],
      run: { distanceKm: 8.05, seconds: 2400, time: "40:00" },
    },
  ];

  it("shows sets in pounds and the run in miles", () => {
    const html = renderToStaticMarkup(
      <DayDetails
        dayLabel="Monday, November 23"
        workouts={workouts as never}
        units={LB_MI}
      />,
    );
    expect(html).toContain("5 reps × 135 lb");
    expect(html).toContain("Run: 5 mi in 40:00");
    expect(html).not.toContain(" kg");
    expect(html).not.toContain(" km");
  });

  it("shows kilograms and kilometres for that setting", () => {
    const html = renderToStaticMarkup(
      <DayDetails
        dayLabel="Monday, November 23"
        workouts={workouts as never}
        units={KG_KM}
      />,
    );
    expect(html).toContain("5 reps × 61.25 kg");
    expect(html).toContain("Run: 8.05 km in 40:00");
  });
});

describe("progress", () => {
  const entries = [
    { date: "2026-10-01", weightKg: 83.5, note: null },
    { date: "2026-11-24", weightKg: 81.65, note: null },
  ];

  it("shows body weights, the change and the form in pounds", () => {
    const html = renderToStaticMarkup(
      <BodyWeightSection entries={entries} today="2026-11-24" units={LB_MI} />,
    );
    expect(html).toContain("Latest: 180 lb");
    expect(html).toContain("4.1 lb less than");
    expect(html).toContain("Weight (lb)");
    expect(html).toContain("Lightest 180 lb, heaviest 184.1 lb");
    expect(html).toMatch(/name="weightUnit"[^>]*value="LB"/);
    expect(html).not.toContain(" kg");
  });

  it("lists the latest runs in miles with a hidden unit on the form", () => {
    const html = renderToStaticMarkup(
      <RunLogSection
        runs={[
          {
            id: 1,
            day: "2026-11-23",
            distanceKm: 8.05,
            time: "40:00",
            durationSec: 2400,
            effort: null,
            note: null,
            planDayName: null,
          },
        ]}
        today="2026-11-24"
        distanceUnit="MI"
      />,
    );
    expect(html).toContain("5 mi");
    expect(html).toContain("Distance (mi)");
    expect(html).toMatch(/name="distanceUnit"[^>]*value="MI"/);
    expect(html).not.toContain(" km");
  });

  it("captions a progress photo in the chosen unit", () => {
    const photo = {
      takenAt: new Date("2026-11-12T15:00:00Z"),
      weightKg: 81.65,
    };
    expect(photoCaption(photo, "LB")).toBe("Nov 12, 2026 · 180 lb");
    expect(photoAlt(photo, "LB")).toBe(
      "Progress photo from Nov 12, 2026, 180 lb",
    );
    expect(photoCaption(photo)).toBe("Nov 12, 2026 · 81.65 kg");
  });

  it("asks for the photo weight in pounds within pound limits", () => {
    const html = renderToStaticMarkup(<PhotoUploadForm weightUnit="LB" />);
    expect(html).toContain("Weight (lb, optional)");
    expect(html).toContain('min="45"');
    expect(html).toContain('max="881"');
    expect(html).toMatch(/name="weightUnit"[^>]*value="LB"/);
  });
});

describe("import preview", () => {
  const summary = {
    workouts: 3,
    newWorkouts: 2,
    sets: 40,
    firstDay: "2024-06-20",
    lastDay: "2024-07-01",
    skippedWarmups: 4,
    skippedRows: 1,
    repairableWorkouts: 0,
  };

  it("names the unit the user chose instead of saying kg", () => {
    const pounds = renderToStaticMarkup(
      <ImportPreview
        summary={summary}
        unmatched={[]}
        library={[]}
        weightUnit="LB"
      />,
    );
    expect(pounds).toContain("Weights are shown in pounds (lb)");
    expect(pounds).not.toContain("saved in kg");
    const kilograms = renderToStaticMarkup(
      <ImportPreview
        summary={summary}
        unmatched={[]}
        library={[]}
        weightUnit="KG"
      />,
    );
    expect(kilograms).toContain("Weights are shown in kilograms (kg)");
  });
});
