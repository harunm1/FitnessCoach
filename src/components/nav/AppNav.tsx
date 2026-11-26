import Link from "next/link";
import type { ReactNode } from "react";
import { AccountBrand, AccountIcon } from "@/components/auth/account-ui";
import { ThemeToggle } from "@/components/auth/account-theme";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserBadge } from "@/components/photos/UserBadge";

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
// page's text colour, so it fits both the light and dark themes.
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
      className={`flex w-full flex-wrap items-center gap-x-6 gap-y-3 ${className}`}
    >
      {/* The same FitnessCoach logo as the sign-in pages. It links to /,
          which sends signed-in users to their session. */}
      <AccountBrand light />
      <nav
        aria-label="Main"
        className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
      >
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0">
          {NAV_LINKS.map(({ page, href, label }) => (
            <li key={page}>
              <Link
                href={href}
                aria-current={current === page ? "page" : undefined}
                className={
                  current === page
                    ? "text-sm font-semibold whitespace-nowrap underline decoration-2 underline-offset-4"
                    : "text-sm whitespace-nowrap opacity-70 hover:opacity-100"
                }
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-4 max-sm:[&_button>span]:hidden">
        <UserBadge
          name={name}
          imageUrl={avatarUrl}
          current={current === "account"}
        />
        <ThemeToggle />
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-foreground/70">
          <AccountIcon name="shield" size={16} />
          <span className="max-sm:hidden">Verified account</span>
        </span>
        <SignOutButton />
        {actions}
      </div>
    </header>
  );
}
