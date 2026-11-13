import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { monthGrid } from "@/lib/progress/view";
import ActivityCalendar from "./ActivityCalendar";
import DayDetails from "./DayDetails";
import MuscleMap from "./MuscleMap";
import MuscleStats from "./MuscleStats";
import PhotoStrip from "./PhotoStrip";
import StreakCards from "./StreakCards";

const render = renderToStaticMarkup;

describe("StreakCards", () => {
  it("shows both streaks, with week or weeks", () => {
    const html = render(<StreakCards activeWeeks={1} goalMetWeeks={3} />);
    expect(html).toContain("Active streak");
    expect(html).toContain("1 week<");
    expect(html).toContain("Goal streak");
    expect(html).toContain("3 weeks");
    expect(html).toContain("reaching your plan&#x27;s weekly workouts");
  });
});

describe("ActivityCalendar", () => {
  const html = render(
    <ActivityCalendar
      activity={{
        "2026-11-08": { workouts: 1, hasRun: false },
        "2026-11-10": { workouts: 2, hasRun: true },
      }}
      hrefFor={({ month, day }) => `/progress?month=${month}&day=${day ?? ""}`}
      month="2026-11"
      nextMonth="2026-12"
      previousMonth="2026-10"
      selectedDay="2026-11-08"
      today="2026-11-12"
      weeks={monthGrid("2026-11")}
    />,
  );

  it("names the month and links to the months around it", () => {
    expect(html).toContain("November 2026");
    expect(html).toContain('aria-label="Previous month, October 2026"');
    expect(html).toContain('aria-label="Next month, December 2026"');
  });

  it("describes each day for screen readers, including runs", () => {
    expect(html).toContain('aria-label="Sunday, November 8, 1 workout"');
    expect(html).toContain(
      'aria-label="Tuesday, November 10, 2 workouts, with a run"',
    );
    expect(html).toContain('aria-label="Monday, November 9, no workout"');
  });

  it("marks the selected day and links every day", () => {
    expect(html).toMatch(/aria-current="date"[^>]*November 8/);
    expect(html).toContain('href="/progress?month=2026-11&amp;day=2026-11-30"');
  });
});

describe("DayDetails", () => {
  it("asks for a day when none is selected", () => {
    expect(render(<DayDetails dayLabel={null} workouts={[]} />)).toContain(
      "Tap a day in the calendar",
    );
  });

  it("says when the day had no workout", () => {
    expect(
      render(<DayDetails dayLabel="Monday, November 9" workouts={[]} />),
    ).toContain("No workout this day.");
  });

  it("lists sets by exercise and the run with its pace", () => {
    const html = render(
      <DayDetails
        dayLabel="Sunday, November 8"
        workouts={[
          {
            id: 1,
            name: "Push",
            startTime: "12:00 PM",
            minutes: 50,
            exercises: [
              {
                name: "Push-up",
                sets: [
                  {
                    exerciseName: "Push-up",
                    category: "strength",
                    primaryMuscles: ["chest"],
                    secondaryMuscles: [],
                    setNumber: 1,
                    reps: 12,
                    weightKg: null,
                  },
                ],
              },
            ],
            run: { distanceKm: 5, time: "30:00", pace: "6:00 /km" },
          },
        ]}
      />,
    );
    expect(html).toContain("Push");
    expect(html).toContain("12:00 PM · 50 min");
    expect(html).toContain("12 reps");
    expect(html).not.toContain("× null");
    expect(html).toContain("Run: 5 km in 30:00 · 6:00 /km");
  });
});

describe("MuscleStats", () => {
  it("says when there is no strength work", () => {
    expect(render(<MuscleStats shares={[]} workouts={0} />)).toContain(
      "No strength work to show yet.",
    );
  });

  it("shows how many workouts used each muscle", () => {
    const html = render(
      <MuscleStats
        shares={[{ muscle: "chest", workouts: 2, share: 0.5 }]}
        workouts={4}
      />,
    );
    expect(html).toContain("chest");
    expect(html).toContain("2 of 4 · 50%");
  });
});

describe("MuscleMap", () => {
  it("draws the front and back with the given label", () => {
    const html = render(
      <MuscleMap label="Muscles worked in November 2026" slugs={["chest"]} />,
    );
    expect(html).toContain('aria-label="Muscles worked in November 2026"');
    expect(html).toContain(">front<");
    expect(html).toContain(">back<");
    expect(html).toContain("<svg");
  });
});

describe("PhotoStrip", () => {
  const photo = (id: number) => ({
    id,
    url: `memory://p${id}.webp?expires=300`,
    takenAt: new Date("2026-11-12T17:00:00Z"),
    weightKg: null,
    note: null,
  });

  it("shows the newest photos and links to all of them", () => {
    const html = render(
      <PhotoStrip photos={[photo(3), photo(2), photo(1)]} total={7} />,
    );
    expect(html.match(/<img/g)).toHaveLength(3);
    expect(html).toContain('src="memory://p3.webp?expires=300"');
    expect(html).toContain("See all (7)");
    expect(html).toContain('href="/progress/photos"');
  });

  it("invites a first photo when there are none", () => {
    const html = render(<PhotoStrip photos={[]} total={0} />);
    expect(html).toContain("No photos yet.");
    expect(html).toContain("Add a photo");
  });

  it("explains when photos can't be shown", () => {
    const html = render(<PhotoStrip photos={null} total={2} />);
    expect(html).toContain("Photos can&#x27;t be shown right now.");
  });
});
