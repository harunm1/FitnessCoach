import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ClipboardList,
  Dumbbell,
  History,
  MessageCircle,
  Settings,
  TrendingUp,
  Upload,
} from "lucide-react";

export type NavPage =
  | "session"
  | "programs"
  | "coach"
  | "progress"
  | "photos"
  | "history"
  | "import"
  | "account";

// The pages a signed-in user can move between, in menu order. Settings is the
// account page.
export const NAV_LINKS: {
  page: NavPage;
  href: string;
  label: string;
  Icon: LucideIcon;
}[] = [
  { page: "session", href: "/session", label: "Session", Icon: Dumbbell },
  {
    page: "programs",
    href: "/programs",
    label: "Programs",
    Icon: ClipboardList,
  },
  { page: "coach", href: "/coach", label: "Coach", Icon: MessageCircle },
  { page: "progress", href: "/progress", label: "Progress", Icon: TrendingUp },
  { page: "photos", href: "/progress/photos", label: "Photos", Icon: Camera },
  { page: "history", href: "/history", label: "History", Icon: History },
  { page: "import", href: "/import", label: "Import", Icon: Upload },
  { page: "account", href: "/account", label: "Settings", Icon: Settings },
];

// One accent for the current page (a tinted block with the accent colour); the
// others are muted and light up on hover. All colours are the page theme's tokens.
const LINK_BASE =
  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium whitespace-nowrap outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--focus)]";
const LINK_CURRENT = "bg-[var(--brand-soft)] text-[var(--brand)]";
const LINK_OTHER =
  "text-[var(--shell-muted)] hover:bg-[var(--inset)] hover:text-[var(--text)]";

// The main nav: an icon beside each label, and aria-current on the page the
// user is on. Used by the sidebar and by the phone menu.
export function NavLinks({ current }: { current?: NavPage }) {
  return (
    <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {NAV_LINKS.map(({ page, href, label, Icon }) => (
          <li key={page}>
            <Link
              href={href}
              aria-current={current === page ? "page" : undefined}
              className={`${LINK_BASE} ${current === page ? LINK_CURRENT : LINK_OTHER}`}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
