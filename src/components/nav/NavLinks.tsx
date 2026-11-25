"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { NavPage } from "./AppNav";

type NavLink = {
  page: Exclude<NavPage, "account">;
  href: string;
  label: string;
};

// The main pages in the header (live bug L1, 25 Nov 2026). Three layouts, chosen by the
// header's own width (the "nav" container in AppNav), not the screen's, because the page
// column can be narrower than the screen:
//   under 36rem   a Menu button that opens a column of links (a phone);
//   36rem and up  the links in a row of their own below the logo and the controls;
//   72rem and up  the links in the same row as the logo and the controls.
// It is one list in every layout, so there is one set of links for a screen reader.
export function NavLinks({
  current,
  links,
}: {
  current?: NavPage;
  links: NavLink[];
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <nav
      aria-label="Main"
      className="order-last grid w-full min-w-0 gap-2 @6xl/nav:order-none @6xl/nav:w-auto @6xl/nav:flex-1"
    >
      <button
        aria-controls={listId}
        aria-expanded={open}
        className="min-h-11 w-fit border border-current/30 px-4 text-sm font-medium @xl/nav:hidden"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Menu
      </button>
      <ul
        className={`m-0 list-none gap-x-4 gap-y-1 p-0 @xl/nav:flex @xl/nav:flex-row @xl/nav:flex-nowrap @xl/nav:items-center ${
          open ? "flex flex-col" : "hidden"
        }`}
        id={listId}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        {links.map(({ page, href, label }) => (
          <li key={page}>
            <Link
              aria-current={current === page ? "page" : undefined}
              className={`inline-flex min-h-11 items-center text-sm whitespace-nowrap @xl/nav:min-h-0 ${
                current === page
                  ? "font-semibold underline decoration-2 underline-offset-4"
                  : "opacity-70 hover:opacity-100"
              }`}
              href={href}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
