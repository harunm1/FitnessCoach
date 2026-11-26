import type { ReactNode } from "react";
import { AccountBrand, AccountIcon } from "@/components/auth/account-ui";
import { ThemeToggle } from "@/components/auth/account-theme";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserBadge } from "@/components/photos/UserBadge";
import { NavLinks } from "./NavLinks";

export type NavPage =
  | "session"
  | "programs"
  | "coach"
  | "progress"
  | "photos"
  | "history"
  | "import"
  | "account";

// The main pages a signed-in user can move between, in menu order.
export const NAV_LINKS: {
  page: Exclude<NavPage, "account">;
  href: string;
  label: string;
}[] = [
  { page: "session", href: "/session", label: "Session" },
  { page: "programs", href: "/programs", label: "Programs" },
  { page: "coach", href: "/coach", label: "Coach" },
  { page: "progress", href: "/progress", label: "Progress" },
  { page: "photos", href: "/progress/photos", label: "Photos" },
  { page: "history", href: "/history", label: "History" },
  { page: "import", href: "/import", label: "Import" },
];

// The bar at the top of every signed-in page: the logo, the main pages,
// and the user's badge, which opens the account page. Colours follow the
// page's text colour, so it fits both the light and dark themes. The header
// is a container ("nav"), so NavLinks lays the links out by the header's own
// width: a menu on a phone, a row of their own on a narrow page column, and
// the same row as the logo only when all three fit (live bug L1, 25 Nov 2026).
// `current` marks the page the user is on; `actions` holds a page's own
// controls, like the theme toggle or sign out.
export function AppNav({
  current,
  name,
  avatarUrl,
  actions,
  className = "mb-10 border-b border-current/15 pb-5",
}: {
  current?: NavPage;
  name: string;
  avatarUrl: string | null;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`@container/nav flex w-full flex-wrap items-center gap-x-6 gap-y-3 ${className}`}
    >
      {/* The same FitnessCoach logo as the sign-in pages. It links to /,
          which sends signed-in users to their session. */}
      <AccountBrand light />
      <NavLinks current={current} links={NAV_LINKS} />
      <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-4 max-sm:[&_button>span]:hidden">
        <UserBadge
          name={name}
          imageUrl={avatarUrl}
          current={current === "account"}
        />
        <ThemeToggle />
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-foreground/70">
          <AccountIcon name="shield" size={16} />
          <span className="hidden @min-[88rem]/nav:inline">
            Verified account
          </span>
        </span>
        <SignOutButton />
        {actions}
      </div>
    </header>
  );
}
