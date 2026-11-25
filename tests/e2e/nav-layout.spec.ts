import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";

// Live bug L1, 25 Nov 2026: the top navigation's six links stacked in a column between the
// logo and the account controls on a signed-in page. Checked at a phone, a tablet and a laptop.
const LINKS = ["Session", "Coach", "Progress", "Photos", "History", "Import"];
const ROW_TOLERANCE_PX = 2;

async function signIn(page: Page, db: Client) {
  const email = `nav-layout-${randomUUID()}@example.test`;
  const password = "Nav-layout-password-123!";
  // A separate address keeps this test out of the sign-in rate limit, like photos.spec.ts.
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `2001:db8:${randomUUID().slice(0, 4)}::3`,
  });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: "http://127.0.0.1:13100" },
    data: { name: "Nav Athlete", email, password },
  });
  expect(signup.ok()).toBe(true);
  await db.query('UPDATE "User" SET "emailVerified" = true WHERE email = $1', [
    email,
  ]);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

const mainLinks = (page: Page) =>
  page.getByRole("navigation", { name: "Main" }).getByRole("link");

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the main links sit in one row on a laptop and a tablet, and in a menu on a phone", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  await db.connect();
  try {
    await signIn(page, db);

    for (const width of [1280, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/history");
      await expect(mainLinks(page)).toHaveText(LINKS);
      const tops = await mainLinks(page).evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getBoundingClientRect().top),
      );
      expect(
        Math.max(...tops) - Math.min(...tops),
        `links share one row at ${width}px`,
      ).toBeLessThanOrEqual(ROW_TOLERANCE_PX);
      await expect(
        page.getByRole("button", { name: "Menu", exact: true }),
      ).toBeHidden();
      await noSideScroll(page);
    }

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/history");
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(mainLinks(page).first()).toBeHidden();
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(mainLinks(page)).toHaveText(LINKS);
    await noSideScroll(page);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  } finally {
    await db.end();
  }
});
