import Link from "next/link";
import { ExportButton } from "@/components/account/ExportButton";
import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import theme from "@/components/theme/app-theme.module.css";
import { requireUser } from "@/lib/auth/session";
import { EXPORTS_KEPT } from "@/lib/exports/limits";
import { exportLabel } from "@/lib/exports/names";
import { loadAvatar } from "@/lib/photos/avatar";
import { prisma } from "@/lib/prisma";

// The list changes with every export, so build the page fresh on every visit.
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  dateStyle: "medium",
  timeStyle: "short",
});
const BYTES_PER_KB = 1024;

const sizeText = (bytes: number) =>
  `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;

export default async function YourDataPage() {
  const user = await requireUser();
  const [avatar, exports] = await Promise.all([
    loadAvatar(user.id),
    prisma.dataExport.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: EXPORTS_KEPT,
      select: { id: true, kind: true, bytes: true, createdAt: true },
    }),
  ]);

  return (
    <AccountTheme
      className={`${theme.appTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className={`mx-auto max-w-3xl ${theme.readablePage}`}>
        <AppNav
          current="account"
          name={user.name}
          avatarUrl={avatar?.url ?? null}
        />

        <section className="mb-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
            Account
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Your data</h1>
          <p className="mt-3 text-sm text-foreground/70">
            Download your own data as spreadsheets (workout dates are Toronto
            days; coach messages are UTC times). Each file is made when you ask,
            kept privately for you, and the newest {EXPORTS_KEPT} are kept.
            Weights use your unit.{" "}
            <Link href="/account" className="underline underline-offset-4">
              Back to your account
            </Link>
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <ExportButton
            kind="WORKOUT_CSV"
            label="Export workout history (CSV)"
          />
          <ExportButton
            kind="COACH_CSV"
            label="Export coach conversations (CSV)"
          />
        </section>

        <section className="mt-10" aria-labelledby="past-exports">
          <h2 id="past-exports" className="text-lg font-semibold">
            Your exports
          </h2>
          {exports.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/70">
              No exports yet. Make one above and it will appear here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-foreground/15 border-y border-foreground/15">
              {exports.map((item) => {
                const label = exportLabel(item.kind);
                const when = dateFormat.format(item.createdAt);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span>
                      <span className="font-medium">{label}</span>
                      <span className="block text-xs text-foreground/70">
                        {when} · {sizeText(item.bytes)}
                      </span>
                    </span>
                    <a
                      href={`/api/exports/${item.id}/download`}
                      aria-label={`Download ${label}, made ${when}`}
                      className="min-h-11 content-center underline underline-offset-4"
                    >
                      Download
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AccountTheme>
  );
}
