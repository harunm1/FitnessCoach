import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/account-theme", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
  useAccountTheme: () => "light",
}));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: ({ variant }: { variant?: string }) => (
    <button type="button" data-variant={variant}>
      Sign out
    </button>
  ),
}));

import { AppNav, NAV_LINKS } from "./AppNav";

// Every <a> in the markup as { href, text, current }.
function links(html: string) {
  return [...html.matchAll(/<a\s([^>]*)>(.*?)<\/a>/g)].map(
    ([, attrs, text]) => ({
      href: attrs.match(/href="([^"]*)"/)?.[1] ?? null,
      text: text.replace(/<[^>]*>/g, "").trim(),
      current: attrs.includes('aria-current="page"'),
    }),
  );
}

function render(props: Partial<Parameters<typeof AppNav>[0]> = {}) {
  return renderToStaticMarkup(
    <AppNav name="Free Demo" avatarUrl={null} {...props} />,
  );
}

describe("AppNav sidebar", () => {
  it("links the logo, every main page, Settings, the user's name, then the phone bar's logo", () => {
    expect(links(render()).map(({ href, text }) => ({ href, text }))).toEqual([
      { href: "/", text: "FitnessCoach" },
      { href: "/session", text: "Session" },
      { href: "/programs", text: "Programs" },
      { href: "/coach", text: "Coach" },
      { href: "/progress", text: "Progress" },
      { href: "/progress/photos", text: "Photos" },
      { href: "/history", text: "History" },
      { href: "/import", text: "Import" },
      { href: "/account", text: "Settings" },
      { href: "/account", text: "Free Demo" },
      { href: "/", text: "FitnessCoach" },
    ]);
  });

  it("is a fixed sidebar that the page content can offset for", () => {
    const html = render();
    expect(html).toContain("data-app-sidebar");
    expect(html).toMatch(
      /<aside[^>]*data-app-sidebar[^>]*class="[^"]*\bfixed\b/,
    );
  });

  it("puts the main pages in a labelled nav", () => {
    expect(render()).toContain('<nav aria-label="Main"');
  });

  it("gives every page link an icon beside its label", () => {
    const nav =
      render().match(/<nav aria-label="Main"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav.match(/<svg/g)?.length).toBe(NAV_LINKS.length);
  });

  it.each([
    ["session", "/session"],
    ["programs", "/programs"],
    ["coach", "/coach"],
    ["progress", "/progress"],
    ["photos", "/progress/photos"],
    ["history", "/history"],
    ["import", "/import"],
  ] as const)("marks only %s as the current page", (current, href) => {
    const found = links(render({ current }));
    expect(
      found.filter((link) => link.current).map((link) => link.href),
    ).toEqual([href]);
  });

  it("marks Settings (and the user's name, which opens it) on the account page", () => {
    const current = links(render({ current: "account" })).filter(
      (link) => link.current,
    );
    expect(current.map((link) => link.text)).toEqual(["Settings", "Free Demo"]);
  });

  it("marks no page as current when the page isn't in the menu", () => {
    expect(links(render()).some((link) => link.current)).toBe(false);
  });

  it("shows the profile photo when there is one", () => {
    expect(render({ avatarUrl: "https://example.com/me.png" })).toContain(
      'src="https://example.com/me.png"',
    );
  });

  it("shows the page's own controls once, in the in-flow header", () => {
    const html = render({
      actions: <button type="button">Edit profile</button>,
    });
    expect(html.match(/Edit profile/g)).toHaveLength(1);
  });

  it("has the theme toggle and ONE icon-only sign-out, and no verified badge", () => {
    const html = render();
    expect(html).toContain("Theme");
    expect(html.match(/Sign out/g)).toHaveLength(1);
    expect(html).toContain('data-variant="icon"');
    expect(html).not.toContain("Verified account");
  });

  it("keeps the in-flow header for phones only, apart from page actions", () => {
    expect(render()).toMatch(/<header[^>]*class="[^"]*\blg:hidden\b/);
  });
});
