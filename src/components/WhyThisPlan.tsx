// "Why this plan" panel (#66): a server component that renders the rows from whyThisPlan().
// Plain Tailwind (border, spacing). When #77 lands, swap the section's classes for Card's but
// keep the section element and the h2/h3 headings: shadcn's CardTitle renders a div, not a heading.
// Meaning is carried by headings and sentences, never by colour alone.
import type { WhyRow } from "@/lib/coach/whyThisPlan";

type WhyThisPlanProps = {
  rows: WhyRow[];
  // Makes the heading id unique when more than one panel is on a page (for example a plan id).
  idPrefix?: string;
};

export default function WhyThisPlan({
  rows,
  idPrefix = "why-this-plan",
}: WhyThisPlanProps) {
  if (rows.length === 0) return null;
  const headingId = `${idPrefix}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="border border-foreground/15 p-5"
    >
      <h2 id={headingId} className="text-sm font-semibold">
        Why this plan
      </h2>
      <div className="mt-4 grid gap-4">
        {rows.map((row) => (
          <div key={row.id}>
            <h3 className="text-xs font-semibold tracking-[0.14em] text-foreground/70 uppercase">
              {row.title}
            </h3>
            <p className="mt-1 text-sm text-foreground/80">{row.summary}</p>
            {row.details.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/80">
                {row.details.map((detail, index) => (
                  <li key={`${index}-${detail}`}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
