// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/account-theme", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { AppNav } from "./AppNav";
import { NavLinks } from "./NavLinks";

// Live bug L1, 25 Nov 2026: on a 768 px page the six links stacked in a column between the
// logo and the account controls. They shared one row with the logo and the controls, got what
// was left, and wrapped one per line. Now the links take their own row whenever the header is
// narrower than the three together, and become a menu on a phone. Layout is decided by the
// header's own width (a container query), because the page container is narrower than the screen.
const links = [
  { page: "session" as const, href: "/session", label: "Session" },
  { page: "history" as const, href: "/history", label: "History" },
];

afterEach(cleanup);

describe("the header's layout classes", () => {
  const html = renderToStaticMarkup(
    <AppNav name="Free Demo" avatarUrl={null} />,
  );

  it("measures itself, so a narrow page column is treated as narrow on any screen", () => {
    expect(html).toMatch(/<header[^>]*class="[^"]*@container\/nav/);
  });

  it("puts the links on their own full-width row until the header is wide enough for one row", () => {
    const nav = html.match(/<nav[^>]*>/)?.[0] ?? "";
    expect(nav).toContain("order-last");
    expect(nav).toContain("w-full");
    expect(nav).toContain("@7xl/nav:order-none");
    expect(nav).toContain("@7xl/nav:flex-1");
    expect(nav).not.toContain("sm:flex-1");
  });

  it("never wraps the links inside their row once they have a row to themselves", () => {
    const list = html.match(/<ul[^>]*>/)?.[0] ?? "";
    expect(list).toContain("@xl/nav:flex-nowrap");
  });
});

describe("NavLinks as a menu on a phone", () => {
  it("hides the links behind a Menu button until it is pressed", () => {
    render(<NavLinks current="history" links={links} />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.className).toContain("@xl/nav:hidden");
    expect(screen.getByRole("list").className).toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("opens to a column of links, and the button says it is open", () => {
    render(<NavLinks current="history" links={links} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen
        .getByRole("button", { name: "Menu" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByRole("list").className).toContain("flex-col");
  });

  // Verifier finding 3: Escape was handled on the list only, so it did nothing while focus sat
  // on the Menu button, and a keyboard user pressing it from a link lost their place.
  it("closes with Escape from the Menu button too", () => {
    render(<NavLinks current="history" links={links} />);
    const button = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("puts focus back on the Menu button when Escape closes it from a link", () => {
    render(<NavLinks current="history" links={links} />);
    const button = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(button);
    const link = screen.getByText("Session");
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes again with Escape, and keeps the current page marked", () => {
    render(<NavLinks current="history" links={links} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.keyDown(screen.getByRole("list"), { key: "Escape" });
    expect(
      screen
        .getByRole("button", { name: "Menu" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.getByText("History").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("links the button to the list it opens", () => {
    render(<NavLinks current={undefined} links={links} />);
    const controls = screen
      .getByRole("button", { name: "Menu" })
      .getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(screen.getByRole("list").id).toBe(controls);
  });
});
