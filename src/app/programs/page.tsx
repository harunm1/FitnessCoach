import { AccountTheme } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import ProgramBuilder from "@/components/programs/ProgramBuilder";
import ProgramFolders from "@/components/programs/ProgramFolders";
import theme from "@/components/theme/app-theme.module.css";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { closestTemplate } from "@/lib/programs/closest";
import { loadProgramFolders } from "@/lib/programs/folders";
import { navAvatar } from "../history/avatar";

// A saved program shows up on the next visit, so build the page on every request.
export const dynamic = "force-dynamic";

// Programs (D38): the user's programs as folders, then a template to start from or
// "Build with the coach", which starts from the template closest to the quiz answers.
export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[] }>;
}) {
  const { start } = await searchParams;
  const user = await requireUser();
  const [folders, profile, avatarUrl] = await Promise.all([
    loadProgramFolders(user.id),
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { daysPerWeek: true, level: true, goal: true },
    }),
    navAvatar(user.id),
  ]);
  const closestId = profile ? closestTemplate(profile).id : null;

  return (
    <AccountTheme
      className={`${theme.appTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className={`mx-auto max-w-3xl ${theme.readablePage}`}>
        <AppNav current="programs" name={user.name} avatarUrl={avatarUrl} />
        <p className="text-xs font-semibold tracking-[0.14em] text-foreground/60 uppercase">
          Your training
        </p>
        <h1 className="mt-3 mb-8 text-3xl font-semibold sm:text-4xl">
          Programs
        </h1>

        <section aria-labelledby="your-programs" className="mb-10">
          <h2 id="your-programs" className="mb-3 text-xl font-semibold">
            Your programs
          </h2>
          <ProgramFolders plans={folders} />
        </section>

        <section id="start-program" aria-labelledby="start-program-heading">
          <h2 id="start-program-heading" className="mb-1 text-xl font-semibold">
            Start a program
          </h2>
          <p className="mb-4 text-sm text-foreground/70">
            Pick a template and the coach adapts it to your days, equipment and
            injuries. You see every change with its reason and choose which to
            keep.
            {closestId ? "" : " Take the quiz first so the coach knows you."}
          </p>
          <ProgramBuilder
            closestId={closestId}
            quizDays={profile?.daysPerWeek}
            startWithCoach={start === "coach"}
          />
        </section>
      </div>
    </AccountTheme>
  );
}
