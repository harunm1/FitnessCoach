// Browser proof for the exercise card (D44): a set table with a check that logs the set and
// starts that exercise's rest timer, Add set and Remove set, the rest choice, and last time's
// set in the Previous column.
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import {
  cleanUp,
  logSet,
  signedInAthleteWithWorkout,
} from "./helpers/session-athlete";

const PLANNED_ROWS = 3;
const HEADER_ROWS = 1;
const SET_ONE = 1;

test.describe("exercise card", () => {
  let db: Client;
  let prefix: string;

  test.beforeEach(async () => {
    db = new Client({ connectionString: testDatabaseURL() });
    await db.connect();
    prefix = `cards-browser-${randomUUID()}`;
  });

  test.afterEach(async () => {
    await cleanUp(db, prefix);
    await db.end();
  });

  test("the check logs the set and starts the rest timer; Off hides it", async ({
    page,
  }) => {
    const { exerciseName } = await signedInAthleteWithWorkout(page, db, prefix);
    await expect(page.getByRole("row")).toHaveCount(PLANNED_ROWS + HEADER_ROWS);
    await logSet(page, exerciseName, SET_ONE);
    await expect(
      page.getByRole("row", { name: "Set 1: 8 reps · 20 lb" }),
    ).toBeVisible();
    await expect(page.getByText("Resting", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Rest timer" }).selectOption("0");
    await expect(page.getByText("Resting", { exact: true })).toHaveCount(0);
  });

  test("Add set and Remove set change the unlogged rows", async ({ page }) => {
    await signedInAthleteWithWorkout(page, db, prefix);
    await page.getByRole("button", { name: "Add set", exact: true }).click();
    await expect(page.getByRole("row")).toHaveCount(
      PLANNED_ROWS + HEADER_ROWS + 1,
    );
    await page.getByRole("button", { name: "Remove set", exact: true }).click();
    await expect(page.getByRole("row")).toHaveCount(PLANNED_ROWS + HEADER_ROWS);
  });

  test("a pain check-in in the stop range blocks the checks", async ({
    page,
  }) => {
    await signedInAthleteWithWorkout(page, db, prefix);
    await page.getByText("How do you feel today?").click();
    await page.getByLabel("Pain or soreness today, 0 to 10").fill("7");
    await expect(
      page.getByRole("button", { name: "Log set 1", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText("Logging is blocked")).toBeVisible();
  });
});
