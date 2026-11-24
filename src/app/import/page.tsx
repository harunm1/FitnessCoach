// The import page (#131): bring workout history from another app (a Hevy CSV export).
import { AccountTheme, ThemeToggle } from "@/components/auth/account-theme";
import { AppNav } from "@/components/nav/AppNav";
import { ImportForm } from "@/components/import/ImportForm";
import theme from "@/components/theme/app-theme.module.css";
import { requireUser } from "@/lib/auth/session";
import { signAvatar } from "@/lib/photos/gallery";
import { prisma } from "@/lib/prisma";
import { getPhotoStorage } from "@/lib/storage";

// Signed links expire and the page depends on the user, so build it on every visit.
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireUser();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });
  let avatarUrl: string | null = null;
  try {
    avatarUrl = await signAvatar(
      user.id,
      profile?.image ?? null,
      getPhotoStorage(),
    );
  } catch (error) {
    // Storage not set up: the page still works, with the initial instead of the photo.
    console.error("[import] couldn't sign the avatar link", {
      userId: user.id,
      error,
    });
  }

  return (
    <AccountTheme
      className={`${theme.appTheme} min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12`}
    >
      <div className="mx-auto max-w-3xl">
        <AppNav
          current="import"
          name={user.name}
          avatarUrl={avatarUrl}
          actions={<ThemeToggle />}
        />
        <section className="mb-8">
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Import workouts
          </h1>
          <p className="mt-3 text-sm text-foreground/70">
            Bring your history from Hevy: in Hevy, open Profile, Settings,
            Export &amp; Import Data, Export Data, Export Workouts, then upload
            the file here. Imported workouts are labelled Imported on Progress
            and do not count toward your weekly streaks.
          </p>
        </section>
        <ImportForm />
      </div>
    </AccountTheme>
  );
}
