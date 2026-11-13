import Link from "next/link";

export type CalendarDay = {
  workouts: number;
  hasRun: boolean;
};

type ActivityCalendarProps = {
  month: string; // "2026-11"
  weeks: (string | null)[][]; // day keys, Monday first
  activity: Record<string, CalendarDay>;
  today: string;
  selectedDay?: string;
  hrefFor: (params: { month?: string; day?: string }) => string;
  previousMonth: string;
  nextMonth: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function dayLabel(day: string, activity?: CalendarDay) {
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
  if (!activity) return `${date}, no workout`;
  const count = `${activity.workouts} workout${activity.workouts === 1 ? "" : "s"}`;
  return `${date}, ${count}${activity.hasRun ? ", with a run" : ""}`;
}

// A month of days with workouts highlighted (#16). Every day is a link, so a tap
// (not a hover) opens its details; this is a mobile-first page.
export default function ActivityCalendar({
  month,
  weeks,
  activity,
  today,
  selectedDay,
  hrefFor,
  previousMonth,
  nextMonth,
}: ActivityCalendarProps) {
  return (
    <section aria-labelledby="calendar-title">
      <div className="mb-4 flex items-center justify-between">
        <Link
          aria-label={`Previous month, ${monthLabel(previousMonth)}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg"
          href={hrefFor({ month: previousMonth })}
        >
          ‹
        </Link>
        <h2 className="m-0 text-lg font-semibold" id="calendar-title">
          {monthLabel(month)}
        </h2>
        <Link
          aria-label={`Next month, ${monthLabel(nextMonth)}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg"
          href={hrefFor({ month: nextMonth })}
        >
          ›
        </Link>
      </div>

      <table className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th
                className="pb-2 text-[10px] font-semibold tracking-[0.08em] text-foreground/55 uppercase"
                key={weekday}
                scope="col"
              >
                <abbr title={weekday} className="no-underline">
                  {weekday.slice(0, 1)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={j} />;
                const dayActivity = activity[day];
                const selected = day === selectedDay;
                return (
                  <td className="p-0.5" key={day}>
                    <Link
                      aria-current={selected ? "date" : undefined}
                      aria-label={dayLabel(day, dayActivity)}
                      className={[
                        "relative flex aspect-square min-h-10 items-center justify-center text-sm",
                        dayActivity
                          ? "bg-foreground font-semibold text-background"
                          : "text-foreground/70 hover:bg-foreground/5",
                        selected ? "ring-2 ring-foreground ring-offset-2" : "",
                        day === today && !dayActivity
                          ? "border border-foreground/40"
                          : "",
                      ].join(" ")}
                      href={hrefFor({ month, day })}
                    >
                      {Number(day.slice(8))}
                      {dayActivity?.hasRun && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1 h-1 w-1 rounded-full bg-background"
                        />
                      )}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 mb-0 text-xs text-foreground/60">
        Dark days have a workout; a dot marks a run. Tap a day for details.
      </p>
    </section>
  );
}
