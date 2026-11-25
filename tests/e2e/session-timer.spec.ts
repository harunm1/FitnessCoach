// Browser proof for the session clock and the rest timer (D36): a logged set starts the rest
// countdown, +15 and Skip work, the workout can be paused and resumed, and a workout that has
// sat idle is paused at its last activity with a "Resume or finish?" prompt.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import {
  cleanUp,
  logSet,
  signedInAthleteWithWorkout,
} from "./helpers/session-athlete";

const REST_SECONDS = 90;
const SET_ONE = 1;
const SECONDS_PER_MINUTE = 60;
const EXTRA_SECONDS = 15;
const ELAPSED_ALLOWANCE = 4;
const COUNTDOWN_TIMEOUT_MS = 8000;
const CLOCK_SETTLE_MS = 2500;
const IDLE_HOURS = 3;
const SECONDS_PER_HOUR = 3600;

type ClockRow = {
  activeBankedSeconds: number;
  activeSince: Date | null;
  finishedAt: Date | null;
  durationSeconds: number | null;
};

async function clockRow(db: Client, workoutId: number): Promise<ClockRow> {
  const {
    rows: [row],
  } = await db.query<ClockRow>(
    `SELECT "activeBankedSeconds", "activeSince", "finishedAt", "durationSeconds" FROM "Workout" WHERE id = $1`,
    [workoutId],
  );
  return row;
}

// The rest timer shows mm:ss in its <time> element.
async function restSeconds(page: Page, exerciseName: string): Promise<number> {
  const text = await page
    .getByLabel(`${exerciseName} rest timer`, { exact: true })
    .locator("time")
    .innerText();
  const [minutes, seconds] = text.split(":").map(Number);
  return minutes * SECONDS_PER_MINUTE + seconds;
}

test.describe("session clock and rest timer", () => {
  let db: Client;
  let prefix: string;

  test.beforeEach(async () => {
    db = new Client({ connectionString: testDatabaseURL() });
    await db.connect();
    prefix = `timer-browser-${randomUUID()}`;
  });

  test.afterEach(async () => {
    await cleanUp(db, prefix);
    await db.end();
  });

  test("a logged set starts the rest countdown; +15 adds time and Skip ends the rest", async ({
    page,
  }) => {
    const { exerciseName } = await signedInAthleteWithWorkout(
      page,
      db,
      prefix,
      { restSeconds: REST_SECONDS },
    );
    await logSet(page, exerciseName, SET_ONE);

    await expect(page.getByText("Resting", { exact: true })).toBeVisible({
      timeout: COUNTDOWN_TIMEOUT_MS,
    });
    const first = await restSeconds(page, exerciseName);
    expect(first).toBeLessThanOrEqual(REST_SECONDS);
    // It counts down by itself.
    await expect
      .poll(() => restSeconds(page, exerciseName), {
        timeout: COUNTDOWN_TIMEOUT_MS,
      })
      .toBeLessThan(first);

    const before = await restSeconds(page, exerciseName);
    await page
      .getByRole("button", { name: "Add 15 seconds", exact: true })
      .click();
    // Fifteen seconds were added (a second or two may have run out meanwhile).
    expect(await restSeconds(page, exerciseName)).toBeGreaterThan(
      before + EXTRA_SECONDS - ELAPSED_ALLOWANCE,
    );

    await page
      .getByRole("button", { name: "Subtract 15 seconds", exact: true })
      .click();
    expect(await restSeconds(page, exerciseName)).toBeLessThanOrEqual(before);

    await page.getByRole("button", { name: "Skip rest", exact: true }).click();
    await expect(page.getByText("Resting", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Rest timer", { exact: true })).toBeVisible();
    expect(await restSeconds(page, exerciseName)).toBe(REST_SECONDS);
  });

  test("pause stops the workout clock and resume starts it again", async ({
    page,
  }) => {
    const { workoutId } = await signedInAthleteWithWorkout(page, db, prefix);
    await page.getByRole("button", { name: "Pause clock" }).click();
    await expect(
      page.getByRole("button", { name: "Resume clock" }),
    ).toBeVisible();
    const paused = await clockRow(db, workoutId);
    expect(paused.activeSince).toBeNull();

    const frozen = await page.getByRole("timer").innerText();
    await page.waitForTimeout(CLOCK_SETTLE_MS);
    expect(await page.getByRole("timer").innerText()).toBe(frozen);

    await page.getByRole("button", { name: "Resume clock" }).click();
    await expect(
      page.getByRole("button", { name: "Pause clock" }),
    ).toBeVisible();
    expect((await clockRow(db, workoutId)).activeSince).not.toBeNull();
  });

  test("a workout idle for hours is paused at its last activity and asks 'Resume or finish?'", async ({
    page,
  }) => {
    const { workoutId } = await signedInAthleteWithWorkout(page, db, prefix, {
      startedHoursAgo: IDLE_HOURS,
    });
    await expect(page.getByText("Resume or finish?")).toBeVisible({
      timeout: COUNTDOWN_TIMEOUT_MS,
    });
    // No set and no tap since it started, so it is paused at its start: no time counted for
    // the idle hours.
    const row = await clockRow(db, workoutId);
    expect(row.activeSince).toBeNull();
    expect(row.activeBankedSeconds).toBeLessThan(SECONDS_PER_MINUTE);

    await page
      .getByRole("button", { name: "Finish workout now", exact: true })
      .first()
      .click();
    await expect(page.getByText("Workout duration")).toBeVisible();
    const finished = await clockRow(db, workoutId);
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.durationSeconds).toBeLessThan(SECONDS_PER_HOUR);
  });
});
