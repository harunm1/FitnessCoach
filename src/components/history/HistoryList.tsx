import Link from "next/link";
import type { HistoryRow } from "@/lib/history/types";
import { dateLabel } from "@/lib/history/view";

const pageHref = (page: number) =>
  page === 1 ? "/history" : `/history?page=${page}`;

// The workout history list (D28): newest first, each row a link to the workout.
export function HistoryList({
  rows,
  page,
  hasNext,
}: {
  rows: HistoryRow[];
  page: number;
  hasNext: boolean;
}) {
  if (rows.length === 0 && page === 1) {
    return (
      <p className="m-0 border-l-2 border-foreground px-3 py-2 text-sm">
        No finished workouts yet.{" "}
        <Link className="underline" href="/session">
          Start today&apos;s session
        </Link>{" "}
        and it will show up here.
      </p>
    );
  }
  return (
    <div className="grid gap-6">
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-foreground/60">
          No workouts on this page.
        </p>
      ) : (
        <ol role="list" className="m-0 grid gap-3 p-0">
          {rows.map((row) => (
            <li className="list-none" key={row.id}>
              <Link
                className="block border border-foreground/15 p-4 hover:bg-foreground/5"
                href={`/history/${row.id}`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-semibold">
                    {row.name}
                    {row.imported && (
                      <span className="ml-2 border border-foreground/30 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                        Imported
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-foreground/60">
                    {row.minutes} min · {row.sets}{" "}
                    {row.sets === 1 ? "set" : "sets"}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-foreground/70">
                  {dateLabel(row.startedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <nav aria-label="History pages" className="flex justify-between text-sm">
        {page > 1 ? (
          <Link
            className="inline-flex min-h-11 items-center underline"
            href={pageHref(page - 1)}
          >
            ‹ Newer
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link
            className="inline-flex min-h-11 items-center underline"
            href={pageHref(page + 1)}
          >
            Older ›
          </Link>
        )}
      </nav>
    </div>
  );
}
