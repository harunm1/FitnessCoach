import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import { signInFreshUser } from "./helpers/signed-in";

// Live bug L1, 25 Nov 2026: the top navigation's six links stacked in a column between the
// logo and the account controls on a signed-in page. Checked at a phone, a tablet and a laptop.
const LINKS = [
  "Session",
  "Programs",
  "Coach",
  "Progress",
  "Photos",
  "History",
  "Import",
];
const ROW_TOLERANCE_PX = 2;

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
    await signInFreshUser(page, db, {
      label: "nav-layout",
      lastAddressGroup: 3,
    });

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
