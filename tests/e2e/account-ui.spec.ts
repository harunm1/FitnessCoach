import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";

test("password controls and mismatch errors support a phone-sized screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("UI Athlete");
  await page.getByLabel("Email", { exact: true }).fill("ui@example.test");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("A-visible-passphrase-123!");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await confirmation.fill("A-different-passphrase-123!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Passwords must match.",
  );
  await expect(confirmation).toBeFocused();
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
});

test("account screens fit phone and tablet widths in both themes", async ({
  page,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of [
        "/sign-in",
        "/sign-up",
        "/verify-email",
        "/forgot-password",
        "/reset-password?error=INVALID_TOKEN",
      ]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("main")).toHaveAttribute(
          "data-theme",
          colorScheme,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${colorScheme} ${width}px ${path}`,
        ).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sign-in");
  await page.screenshot({
    path: test.info().outputPath("signin-dark-desktop.png"),
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({
    path: test.info().outputPath("signin-light-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-up");
  await page.screenshot({
    path: test.info().outputPath("signup-mobile.png"),
    fullPage: true,
  });
});

test("verification remembers the signup email without storing the password", async ({
  page,
}) => {
  const email = `ui-${randomUUID()}@example.test`;
  const db = new Client({ connectionString: testDatabaseURL() });
  await db.connect();
  try {
    await page.goto("/sign-up");
    await page.getByLabel("Name", { exact: true }).fill("Jordan Rivers");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("UI-test-passphrase-123!");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("UI-test-passphrase-123!");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/verify-email$/);
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    expect(
      await page.evaluate(() => Object.values(sessionStorage).join(" ")),
    ).not.toContain("UI-test-passphrase-123!");
    await db.query(
      'UPDATE "User" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("UI-test-passphrase-123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: test.info().outputPath("account-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Switch to dark mode", exact: true })
      .click();
    await expect(page.getByRole("main")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: test.info().outputPath("account-dark-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Start free trial", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", { name: "Trial time remaining" }),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("account-trial-mobile.png"),
      fullPage: true,
    });
  } finally {
    try {
      await db.query('DELETE FROM "User" WHERE email = $1', [email]);
    } finally {
      await db.end();
    }
  }
});

test("account theme follows system changes until a preference is chosen", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/sign-in");
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("main")).toHaveCSS(
    "background-color",
    "rgb(10, 10, 10)",
  );
  const logoMark = page
    .getByRole("link", { name: "FitnessCoach", exact: true })
    .locator(":scope > span")
    .first();
  await expect(logoMark).toHaveCSS("color", "rgb(21, 21, 21)");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCSS("background-color", "rgb(237, 237, 237)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("main")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(logoMark).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCSS("background-color", "rgb(23, 23, 23)");
});

test("keyboard theme selection persists across pages and reloads", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/sign-in");
  const toggle = page.getByRole("button", {
    name: "Switch to dark mode",
    exact: true,
  });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "light");
});

test("theme switching still works when browser storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(page.getByRole("main")).toHaveAttribute("data-theme", "light");
});
