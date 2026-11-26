// Browser proof for the History rows and the Import row menus (D48), at 375 px and on a desktop:
// each History row opens its own workout, and each "map this exercise" menu on the Import preview
// stays inside the screen when an exercise name is long, and takes the choice made in it.
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import { cleanUp, signedInAthleteWithWorkout } from "./helpers/session-athlete";

const PHONE_WIDTH = 375;
const DESKTOP_WIDTH = 1280;
const WIDTHS = [PHONE_WIDTH, DESKTOP_WIDTH];
const HEIGHT = 812;
const PREFIX_LENGTH = 8;
const SPEC_TIMEOUT_MS = 240_000;
const REPORTED_ELEMENTS = 4;
const CLASS_NAME_LENGTH = 60;
const FIXTURE = join(process.cwd(), "tests", "fixtures", "hevy-export.csv");
const LONG_NAME =
  "Barbell Bench Press Medium Grip With Paused Reps And Slow Tempo";

let db: Client;
let prefix: string;

test.beforeAll(async () => {
  db = new Client({ connectionString: testDatabaseURL() });
  await db.connect();
  prefix = `rows${randomUUID().slice(0, PREFIX_LENGTH)}`;
});
test.afterAll(async () => {
  await cleanUp(db, prefix);
  await db.end();
});

// The elements that stick out past the right edge of the window, named so a failure says which.
async function elementsPastTheEdge(page: Page) {
  return page.evaluate(
    ([limit, nameLength]) =>
      [...document.querySelectorAll("body *")]
        .filter(
          (el) => el.getBoundingClientRect().right > window.innerWidth + 1,
        )
        .slice(0, limit)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, nameLength)}`,
        ),
    [REPORTED_ELEMENTS, CLASS_NAME_LENGTH],
  );
}

// Fails with `label` when the element is cut off on the left or the right of the screen.
async function expectInsideScreen(
  element: Locator,
  width: number,
  label: string,
) {
  const box = await element.boundingBox();
  expect(box?.x ?? -1, `${label}: clipped on the left`).toBeGreaterThanOrEqual(
    0,
  );
  expect(
    (box?.x ?? 0) + (box?.width ?? 0),
    `${label}: clipped on the right`,
  ).toBeLessThanOrEqual(width);
}

WIDTHS.forEach((width) => {
  test(`History rows open their own workout and Import row menus fit the screen at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);
    const own = `${prefix}w${width}`;
    const athlete = await signedInAthleteWithWorkout(page, db, own);
    // One finished workout with a set, so History has a row; a long-named exercise for the menus.
    await db.query(
      'UPDATE "Workout" SET "finishedAt" = now() AT TIME ZONE \'UTC\', "activeSince" = NULL WHERE id = $1',
      [athlete.workoutId],
    );
    await db.query(
      'INSERT INTO "SetLog" ("workoutId", "exerciseId", "setNumber", reps) VALUES ($1, $2, 1, 8)',
      [athlete.workoutId, `${own}-press`],
    );
    await db.query(
      `INSERT INTO "Exercise" (id, name, level, equipment, category, "primaryMuscles", "secondaryMuscles", instructions, images, cues, "commonMistakes")
       VALUES ($1, $2, 'BEGINNER', 'barbell', 'strength', '{chest}', '{}', '{}', '{}', '{}', '{}')`,
      [`${own}-long`, `${own} ${LONG_NAME}`],
    );
    await page.setViewportSize({ width, height: HEIGHT });

    await page.goto("/history");
    const row = page.locator(`a[href="/history/${athlete.workoutId}"]`);
    await expect(row).toBeVisible();
    await expectInsideScreen(row, width, "History row");
    expect(await elementsPastTheEdge(page), "History").toEqual([]);
    await row.click();
    await expect(page, "History row target").toHaveURL(
      (url) => url.pathname === `/history/${athlete.workoutId}`,
    );

    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const menus = page.locator('select[name^="map_"]');
    await expect(menus.first()).toBeVisible();
    await Promise.all(
      (await menus.all()).map((menu) =>
        expectInsideScreen(menu, width, "Import menu"),
      ),
    );
    expect(await elementsPastTheEdge(page), "Import").toEqual([]);

    // The choice made in a menu stays selected, on the row it was made in only.
    await menus.first().selectOption(`${own}-long`);
    await expect(menus.first()).toHaveValue(`${own}-long`);
    await expect(menus.nth(1)).toHaveValue("");
  });
});
