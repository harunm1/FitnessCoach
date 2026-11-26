// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/account-theme", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
  useAccountTheme: () => "dark",
}));
vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { MobileNav } from "./MobileNav";

afterEach(cleanup);

function open() {
  render(<MobileNav current="coach" name="Free Demo" avatarUrl={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return screen.findByRole("dialog");
}

describe("MobileNav", () => {
  it("shows only the Menu button until it is opened", () => {
    render(<MobileNav name="Free Demo" avatarUrl={null} />);
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a dialog holding the same page links, Settings and the foot", async () => {
    const dialog = await open();
    const names = within(dialog)
      .getAllByRole("link")
      .map((link) => link.textContent?.trim());
    expect(names).toEqual([
      "FitnessCoach",
      "Session",
      "Programs",
      "Coach",
      "Progress",
      "Photos",
      "History",
      "Import",
      "Settings",
      "Free Demo",
    ]);
    expect(
      within(dialog).getByRole("button", { name: "Sign out" }),
    ).toBeTruthy();
  });

  it("marks the current page inside the dialog", async () => {
    const dialog = await open();
    const current = within(dialog)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent?.trim())).toEqual(["Coach"]);
  });

  it("closes with Escape and hands focus back to the Menu button", async () => {
    await open();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Open menu" }),
      ),
    );
  });

  it("closes with its Close button", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("moves focus into the dialog when it opens, so the page behind is not reachable first", async () => {
    const dialog = await open();
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
  });

  it("uses the page's theme tokens inside the portal", async () => {
    const dialog = await open();
    expect(dialog.getAttribute("data-theme")).toBe("dark");
    // The theme's class is what defines the tokens; without it the data-theme is inert.
    expect(dialog.className).toContain("themeRoot");
  });

  it("closes when the link for the page you are already on is chosen", async () => {
    const dialog = await open();
    // The page does not remount for a same-page link, so the sheet must close itself.
    fireEvent.click(within(dialog).getByRole("link", { name: "Coach" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("has a Close button of at least 44 px that uses the shell's tokens, not shadcn's", async () => {
    const dialog = await open();
    const close = within(dialog).getByRole("button", { name: "Close" });
    expect(close.className).toContain("size-11");
    expect(close.className).toContain("var(--text)");
  });
});
