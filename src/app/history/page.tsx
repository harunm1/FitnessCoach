import Link from "next/link";
import { HistoryList } from "@/components/history/HistoryList";
import { HistoryShell } from "@/components/history/HistoryShell";
import { requireUser } from "@/lib/auth/session";
import { loadHistoryPage } from "@/lib/history/load";
import { parsePage } from "@/lib/history/params";
import { navAvatar } from "./avatar";

// New workouts appear as they are finished, so build the list on every visit.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string | string[] }>;

// Workout history (D29): the signed-in user's finished workouts, newest first.
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  // A repeated ?page= arrives as an array; only one page is shown.
  const page = parsePage(Array.isArray(pageParam) ? pageParam[0] : pageParam);
  const [{ rows, hasNext }, avatarUrl] = await Promise.all([
    loadHistoryPage(user.id, page),
    navAvatar(user.id),
  ]);
  return (
    <HistoryShell
      avatarUrl={avatarUrl}
      eyebrow="Your history"
      name={user.name}
      title="Past workouts"
    >
      <div className="mb-6">
        <Link
          className="inline-flex min-h-11 items-center border border-foreground/30 px-4 text-sm font-semibold hover:bg-foreground/5"
          href="/history/log"
        >
          Log a past workout
        </Link>
      </div>
      <HistoryList hasNext={hasNext} page={page} rows={rows} />
    </HistoryShell>
  );
}
