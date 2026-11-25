import { HistoryList } from "@/components/history/HistoryList";
import { HistoryShell } from "@/components/history/HistoryShell";
import { requireUser } from "@/lib/auth/session";
import { loadHistoryPage } from "@/lib/history/load";
import { parsePage } from "@/lib/history/params";
import { navAvatar } from "./avatar";

// New workouts appear as they are finished, so build the list on every visit.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string | string[] }>;

// Workout history (D28): the signed-in user's finished workouts, newest first.
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
      <HistoryList hasNext={hasNext} page={page} rows={rows} />
    </HistoryShell>
  );
}
