// Browser proof for the app shell (D41): a fixed sidebar from 1024 px and a menu sheet below it, on
// every signed-in page, at 375, 768 and 1280 px in light and dark, with no sideways scrolling.
// Set UI_SHOTS_DIR to also write a screenshot of every page, width and theme into that folder
// (docs/demo/ui/ for the before and after set).
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import { cleanUp, signedInAthleteWithWorkout } from "./helpers/session-athlete";

const PAGES = [
  ["/session", "Session"],
  ["/programs", "Programs"],
  ["/coach", "Coach"],
  ["/progress", "Progress"],
  ["/progress/photos", "Photos"],
  ["/history", "History"],
  ["/import", "Import"],
  ["/account", "Settings"],
] as const;
const WIDTHS = [375, 768, 1280] as const;
const SCHEMES = ["light", "dark"] as const;
const PHONE_HEIGHT = 812;
const DESKTOP_MIN_WIDTH = 1024;
const SIDEBAR_WIDTH = 256;
const PREFIX_LENGTH = 8;
const TAB_PRESSES = 14;
const SHOTS_DIR = process.env.UI_SHOTS_DIR;

let db: Client;
let prefix: string;

test.beforeAll(async () => {
  db = new Client({ connectionString: testDatabaseURL() });
  await db.connect();
  prefix = `shell${randomUUID().slice(0, PREFIX_LENGTH)}`;
});
test.afterAll(async () => {
  await cleanUp(db, prefix);
  await db.end();
});

// The elements that stick out past the right edge of the window (empty when the page fits),
// named so a failure says what to fix.
async function elementsPastTheEdge(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 4)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`,
      ),
  );
}

test("every page has the right navigation and no sideways scroll, at three widths in both themes", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signedInAthleteWithWorkout(page, db, prefix);
  if (SHOTS_DIR) mkdirSync(SHOTS_DIR, { recursive: true });
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: PHONE_HEIGHT });
      for (const [path, label] of PAGES) {
        const where = `${path} at ${width}px, ${scheme}`;
        await page.goto(path);
        await expect(page.locator("main"), where).toBeVisible();
        expect(
          await elementsPastTheEdge(page),
          `${where}: sticks out past the right edge`,
        ).toEqual([]);
        const sidebar = page.locator("[data-app-sidebar]");
        if (width >= DESKTOP_MIN_WIDTH) {
          await expect(sidebar, where).toBeVisible();
          await expect(sidebar.getByRole("link"), where).toHaveCount(
            PAGES.length + 2,
          );
          const box = await page.getByRole("heading").first().boundingBox();
          expect(
            box?.x ?? 0,
            `${where}: content sits under the sidebar`,
          ).toBeGreaterThanOrEqual(SIDEBAR_WIDTH);
          if (new URL(page.url()).pathname === path) {
            await expect(
              sidebar.locator('a[aria-current="page"]').first(),
              where,
            ).toHaveText(label);
          }
        } else {
          await expect(sidebar, where).toBeHidden();
          await expect(
            page.getByRole("button", { name: "Open menu" }),
            where,
          ).toBeVisible();
        }
        await expect(page.getByText("Verified account"), where).toHaveCount(0);
        if (SHOTS_DIR) {
          await page.screenshot({
            path: join(
              SHOTS_DIR,
              `${label.toLowerCase()}-${width}-${scheme}.png`,
            ),
          });
        }
      }
    }
  }
});

test("the phone menu opens, keeps focus inside, and closes with Escape", async ({
  page,
}) => {
  await signedInAthleteWithWorkout(page, db, `${prefix}m`);
  await page.setViewportSize({ width: WIDTHS[0], height: PHONE_HEIGHT });
  await page.goto("/history");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await menuButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "History" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (let press = 0; press < TAB_PRESSES; press += 1) {
    await page.keyboard.press("Tab");
    // The dialog moves focus back in a moment after Tab leaves its last control.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(document.activeElement?.closest('[role="dialog"]')),
          ),
        { message: `focus left the menu on Tab ${press + 1}` },
      )
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test("one click on the sidebar's sign-out icon signs out", async ({ page }) => {
  await signedInAthleteWithWorkout(page, db, `${prefix}s`);
  await page.setViewportSize({ width: WIDTHS[2], height: PHONE_HEIGHT });
  await page.goto("/history");
  await page
    .locator("[data-app-sidebar]")
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(page).toHaveURL((url) => url.pathname === "/sign-in");
});
