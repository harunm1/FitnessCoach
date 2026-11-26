import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import { signInFreshUser } from "./helpers/signed-in";

// Live bug L3, 25 Nov 2026: clicking a date on the Progress calendar scrolled the whole page
// to the workout panel. Picking a date must update the panel in place, keep the scroll
// position, and leave keyboard focus on the date that was chosen.
const PHONE_WIDTH = 375;
const PHONE_HEIGHT = 667;
const PROGRESS_LAST_ADDRESS_GROUP = 4;
const TENTH_DAY_INDEX = 9;
// Accepts "?day=2026-11-15"; rejects "?month=2026-11".
// https://regex101.com/?regex=day%3D%5Cd%7B4%7D-%5Cd%7B2%7D-%5Cd%7B2%7D&testString=%3Fday%3D2026-11-15
const DAY_IN_URL = /day=\d{4}-\d{2}-\d{2}/;
const SCROLLED_PX = 200;
const SCROLL_TOLERANCE_PX = 1;
const DAY_LINK = "table a[aria-label]";

test("choosing a date keeps the page where it is and focus on the date", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  await db.connect();
  try {
    await signInFreshUser(page, db, {
      label: "progress-calendar",
      lastAddressGroup: PROGRESS_LAST_ADDRESS_GROUP,
    });
    await page.setViewportSize({ width: PHONE_WIDTH, height: PHONE_HEIGHT });
    await page.goto("/progress");
    const days = page.locator(DAY_LINK);
    await expect(days.first()).toBeVisible();

    await page.evaluate((top) => window.scrollTo(0, top), SCROLLED_PX);
    const before = await page.evaluate(() => window.scrollY);
    expect(before, "the page is tall enough to scroll").toBeGreaterThan(0);

    const target = days.nth(TENTH_DAY_INDEX);
    await target.scrollIntoViewIfNeeded();
    const scrolledToTarget = await page.evaluate(() => window.scrollY);
    await target.click();
    await expect(page).toHaveURL(DAY_IN_URL);
    await expect(target).toHaveAttribute("aria-current", "date");

    const after = await page.evaluate(() => window.scrollY);
    expect(
      Math.abs(after - scrolledToTarget),
      "the page did not jump to the panel",
    ).toBeLessThanOrEqual(SCROLL_TOLERANCE_PX);
    await expect(target).toBeFocused();
    expect(page.url()).not.toContain("#");
  } finally {
    await db.end();
  }
});
