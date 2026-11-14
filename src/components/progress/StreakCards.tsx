type StreakCardsProps = {
  activeWeeks: number;
  goalMetWeeks: number;
};

function weeks(count: number) {
  return `${count} ${count === 1 ? "week" : "weeks"}`;
}

// The two weekly streaks (#16): any workout in the week, and as many workouts as
// the plan has training days.
export default function StreakCards({
  activeWeeks,
  goalMetWeeks,
}: StreakCardsProps) {
  const cards = [
    {
      label: "Active streak",
      value: weeks(activeWeeks),
      detail: "in a row with at least one workout",
    },
    {
      label: "Goal streak",
      value: weeks(goalMetWeeks),
      detail: "in a row reaching your plan's weekly workouts",
    },
  ];
  return (
    <section aria-labelledby="streaks-title">
      <h2 className="sr-only" id="streaks-title">
        Streaks
      </h2>
      <ul className="grid grid-cols-2 gap-3 p-0">
        {cards.map((card) => (
          <li
            className="list-none border border-foreground/15 p-4"
            key={card.label}
          >
            <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-foreground/55 uppercase">
              {card.label}
            </p>
            <p className="mt-2 mb-0 text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 mb-0 text-xs text-foreground/60">
              {card.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
