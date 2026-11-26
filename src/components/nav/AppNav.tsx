import type { ReactNode } from "react";
import { AccountBrand } from "@/components/auth/account-ui";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS, NavLinks, type NavPage } from "./nav-links";
import { SidebarFoot } from "./SidebarFoot";

export { NAV_LINKS };
export type { NavPage };

// The navigation of every signed-in page (D41). From 1024 px it is a fixed
// left sidebar: the logo, the pages with icons, and at the foot the user's
// photo and name, the theme toggle and a one-click sign-out. Below that it is a
// bar with the logo and a Menu button that opens the same links in a sheet.
// The page's own `<main>` is moved right for the sidebar by a rule in
// globals.css that matches `[data-app-sidebar]`, so a page keeps its own
// container. Colours are the page theme's tokens, so it fits light and dark.
// `current` marks the page the user is on; `actions` holds a page's own small
// controls and is shown once, at the top of the content, at every width.
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
    <>
      <aside
        data-app-sidebar
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-5 border-r border-[var(--line)] bg-[var(--subtle)] p-4 text-[var(--text)] lg:flex"
      >
        <AccountBrand light />
        <NavLinks current={current} />
        <SidebarFoot
          name={name}
          avatarUrl={avatarUrl}
          current={current === "account"}
        />
      </aside>
      <header
        className={`flex w-full items-center gap-3 ${actions ? "lg:mb-6 lg:justify-end lg:border-b-0 lg:pb-0" : "lg:hidden"} ${className}`}
      >
        <div className="lg:hidden">
          <AccountBrand light />
        </div>
        <div className="ml-auto flex items-center gap-3">
          {actions}
          <MobileNav current={current} name={name} avatarUrl={avatarUrl} />
        </div>
      </header>
    </>
  );
}
