import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/account-theme", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { AppNav } from "./AppNav";

// Every <a> in the markup as { href, text, current }.
function links(html: string) {
  return [...html.matchAll(/<a([^>]*)>(.*?)<\/a>/g)].map(([, attrs, text]) => ({
    href: attrs.match(/href="([^"]*)"/)?.[1] ?? null,
    text: text.replace(/<[^>]*>/g, "").trim(),
    current: attrs.includes('aria-current="page"'),
  }));
}

function render(props: Partial<Parameters<typeof AppNav>[0]> = {}) {
  return renderToStaticMarkup(
    <AppNav name="Free Demo" avatarUrl={null} {...props} />,
  );
}

describe("AppNav", () => {
  it("links the logo to the home page, then every main page, then the account", () => {
    expect(links(render()).map(({ href, text }) => ({ href, text }))).toEqual([
      { href: "/", text: "FitnessCoach" },
      { href: "/session", text: "Session" },
      { href: "/coach", text: "Coach" },
      { href: "/progress", text: "Progress" },
      { href: "/progress/photos", text: "Photos" },
      { href: "/history", text: "History" },
      { href: "/import", text: "Import" },
      { href: "/account", text: "Free Demo" },
    ]);
  });

  it("puts the main pages in a labelled nav", () => {
    expect(render()).toContain('<nav aria-label="Main"');
  });

  it.each([
    ["session", "/session"],
    ["coach", "/coach"],
    ["progress", "/progress"],
    ["photos", "/progress/photos"],
    ["import", "/import"],
    ["account", "/account"],
  ] as const)("marks only %s as the current page", (current, href) => {
    const found = links(render({ current }));
    expect(
      found.filter((link) => link.current).map((link) => link.href),
    ).toEqual([href]);
  });

  it("marks no page as current when the page isn't in the menu", () => {
    expect(links(render()).some((link) => link.current)).toBe(false);
  });

  it("shows the profile photo when there is one", () => {
    expect(render({ avatarUrl: "https://example.com/me.png" })).toContain(
      'src="https://example.com/me.png"',
    );
  });

  it("shows the page's own controls beside the badge", () => {
    expect(
      render({ actions: <button type="button">Sign out</button> }),
    ).toContain("Sign out");
  });

  it("includes the common theme, verification and sign-out controls", () => {
    const html = render();
    expect(html).toContain("Theme");
    expect(html).toContain("Verified account");
    expect(html).toContain("Sign out");
  });
});
