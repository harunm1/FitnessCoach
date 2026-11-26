// Browser proof for the workout page (D43): Start opens /session/[id] with only that
// workout, Finish stays in view at phone width from the last exercise, a set logged offline
// still queues there, and a reload (or /session) returns to the same workout.
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";
import {
  cleanUp,
  logSet,
  signedInAthleteWithWorkout,
} from "./helpers/session-athlete";

const PHONE_WIDTH = 375;
const PHONE_HEIGHT = 667;
const PHONE = { width: PHONE_WIDTH, height: PHONE_HEIGHT };
const EXERCISES = 6;
const SET_ONE = 1;
const SYNC_TIMEOUT_MS = 20_000;

test.describe("workout page", () => {
  let db: Client;
  let prefix: string;

  test.beforeEach(async () => {
    db = new Client({ connectionString: testDatabaseURL() });
    await db.connect();
    prefix = `focus-browser-${randomUUID()}`;
  });

  test.afterEach(async () => {
    await cleanUp(db, prefix);
    await db.end();
  });

  test("Start workout lands on /session/[id], with no muscle explorer or run box", async ({
    page,
  }) => {
    await signedInAthleteWithWorkout(page, db, prefix, { withWorkout: false });
    await expect(page.getByText("Explore by muscle")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log a run" })).toBeVisible();
    await page
      .getByRole("button", { name: "Start workout", exact: true })
      .click();

    // Accepts the path of one workout: "/session/42" matches; the landing "/session" and
    // "/session/abc" do not.
    await expect(page).toHaveURL(/\/session\/\d+$/);
    await expect(
      page.getByRole("region", { name: "Workout controls" }),
    ).toBeVisible();
    await expect(page.getByText("Explore by muscle")).toHaveCount(0);
    await expect(page.getByText("Running distance and time")).toHaveCount(0);
  });

  test("Finish workout is in view at 375 px on the last exercise", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    const { lastExerciseName } = await signedInAthleteWithWorkout(
      page,
      db,
      prefix,
      { exerciseCount: EXERCISES },
    );
    await page
      .getByRole("heading", { name: lastExerciseName, exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Finish workout", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("timer")).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Pause clock" }),
    ).toBeInViewport();
    // The last card is not hidden behind the bar.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page
        .getByRole("button", { name: `Log set ${SET_ONE}`, exact: true })
        .last(),
    ).toBeInViewport();
  });

  test("a set logged offline still queues on the workout page", async ({
    page,
    context,
  }) => {
    const { exerciseName } = await signedInAthleteWithWorkout(page, db, prefix);
    await context.setOffline(true);
    await logSet(page, exerciseName, SET_ONE);
    await expect(page.getByText("Saved offline, 1 to sync")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("All sets synced")).toBeVisible({
      timeout: SYNC_TIMEOUT_MS,
    });
  });

  test("a reload and /session both return to the same workout", async ({
    page,
  }) => {
    const { workoutId } = await signedInAthleteWithWorkout(page, db, prefix);
    const address = `/session/${workoutId}`;
    await expect(page).toHaveURL((url) => url.pathname === address);
    await page.reload();
    await expect(page).toHaveURL((url) => url.pathname === address);
    await page.goto("/session");
    await expect(page).toHaveURL((url) => url.pathname === address);
    // Finishing sends the user to the landing, and the finished address does not reopen.
    await page
      .getByRole("button", { name: "Finish workout", exact: true })
      .click();
    await expect(page).toHaveURL((url) => url.pathname === "/session");
    await page.goto(address);
    await expect(page).toHaveURL((url) => url.pathname === "/session");
  });
});
