"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AccountBrand } from "@/components/auth/account-ui";
import { useAccountTheme } from "@/components/auth/account-theme";
import accountStyles from "@/components/auth/account.module.css";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks, type NavPage } from "./nav-links";
import { SidebarFoot } from "./SidebarFoot";

// The phone menu (below 1024 px): a Menu button that opens a left sheet with
// the same links and foot as the sidebar. The sheet is a dialog, so focus
// moves into it, Tab stays inside, and Escape or Close hands focus back to
// the button. It renders in a portal, outside the page's theme wrapper, so it
// carries the theme's class and data-theme itself.
export function MobileNav({
  current,
  name,
  avatarUrl,
}: {
  current?: NavPage;
  name: string;
  avatarUrl: string | null;
}) {
  const theme = useAccountTheme();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--text)] outline-offset-2 hover:bg-[var(--inset)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        data-theme={theme}
        className={`${accountStyles.themeRoot} gap-5 p-4`}
        style={{ background: "var(--subtle)", color: "var(--text)" }}
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">
          Pages, your account and the theme.
        </SheetDescription>
        <AccountBrand light />
        <NavLinks current={current} onNavigate={() => setOpen(false)} />
        <SidebarFoot
          name={name}
          avatarUrl={avatarUrl}
          current={current === "account"}
        />
        {/* After the links in the DOM, so the sheet opens with focus on the first link; it is
            positioned at the top right. */}
        <SheetClose
          aria-label="Close"
          className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-lg text-[var(--text)] outline-offset-2 hover:bg-[var(--inset)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          <X aria-hidden="true" className="size-5" />
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
