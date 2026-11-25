// Demo proof for offline set logging (D31): with the browser offline, two sets are logged
// and shown as waiting; back online they sync, and each is stored exactly once.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";

const ORIGIN = "http://127.0.0.1:13100";
const PASSWORD = "Offline-browser-password-for-tests-123!";
const PLANNED_SETS = 3;
const PLANNED_REPS = 10;
const REST_SECONDS = 90;
const IP_SUFFIX_LENGTH = 4;
const SYNC_TIMEOUT_MS = 15_000;
const SET_ONE = 1;
const SET_TWO = 2;
const TWENTY_LB_IN_KG = "9.07";

type Fixture = { workoutId: number; exerciseName: string };

async function signedInAthleteWithWorkout(
  page: Page,
  db: Client,
  prefix: string,
): Promise<Fixture> {
  const email = `${prefix}@example.test`;
  const exerciseId = `${prefix}-press`;
  const exerciseName = `${prefix} press`;
  const ip = `2001:db8:${randomUUID().slice(0, IP_SUFFIX_LENGTH)}::1`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await db.query(
    `INSERT INTO "Exercise" (id, name, level, equipment, category, "primaryMuscles", "secondaryMuscles", instructions, images, cues, "commonMistakes")
     VALUES ($1, $2, 'BEGINNER', 'body only', 'strength', '{chest}', '{}', '{}', '{}', '{}', '{}')`,
    [exerciseId, exerciseName],
  );
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: ORIGIN, "x-forwarded-for": ip },
    data: { name: "Offline Athlete", email, password: PASSWORD },
  });
  expect(signup.ok()).toBe(true);
  const {
    rows: [user],
  } = await db.query<{ id: string }>(
    'UPDATE "User" SET "emailVerified" = true WHERE email = $1 RETURNING id',
    [email],
  );
  const {
    rows: [plan],
  } = await db.query<{ id: number }>(
    `INSERT INTO "Plan" ("userId", name, source) VALUES ($1, 'Offline plan', 'DEFAULT') RETURNING id`,
    [user.id],
  );
  const {
    rows: [day],
  } = await db.query<{ id: number }>(
    `INSERT INTO "PlanDay" ("planId", "dayIndex", name) VALUES ($1, 0, 'Offline day') RETURNING id`,
    [plan.id],
  );
  await db.query(
    'INSERT INTO "PlanExercise" ("planDayId", "exerciseId", "order", sets, reps, "restSeconds") VALUES ($1, $2, 0, $3, $4, $5)',
    [day.id, exerciseId, PLANNED_SETS, PLANNED_REPS, REST_SECONDS],
  );
  const {
    rows: [workout],
  } = await db.query<{ id: number }>(
    'INSERT INTO "Workout" ("userId", "planId", "planDayId") VALUES ($1, $2, $3) RETURNING id',
    [user.id, plan.id, day.id],
  );

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/account");
  await page.goto("/session");
  await expect(
    page.getByText("Workout in progress since", { exact: false }),
  ).toBeVisible();
  return { workoutId: workout.id, exerciseName };
}

async function logSet(page: Page, exerciseName: string, setNumber: number) {
  const exercise = page.locator("li").filter({
    has: page.getByRole("heading", { name: exerciseName, exact: true }),
  });
  await exercise.getByLabel("REPS", { exact: true }).fill("8");
  // New accounts show pounds (D30); the queue stores kilograms.
  await exercise.getByLabel("LB", { exact: true }).fill("20");
  await exercise
    .getByRole("button", { name: `Log set ${setNumber}`, exact: true })
    .click();
}

async function savedSets(db: Client, workoutId: number) {
  const { rows } = await db.query<{
    setNumber: number;
    weightKg: string;
    keyed: boolean;
  }>(
    `SELECT s."setNumber", s."weightKg"::text AS "weightKg", EXISTS (
       SELECT 1 FROM "QueuedSetKey" k
       WHERE k."workoutId" = s."workoutId" AND k."exerciseId" = s."exerciseId" AND k."setNumber" = s."setNumber"
     ) AS keyed
     FROM "SetLog" s WHERE s."workoutId" = $1 ORDER BY s."setNumber"`,
    [workoutId],
  );
  return rows;
}

test.describe("offline set logging", () => {
  let db: Client;
  let prefix: string;

  test.beforeEach(async () => {
    db = new Client({ connectionString: testDatabaseURL() });
    await db.connect();
    prefix = `offline-browser-${randomUUID()}`;
  });

  test.afterEach(async () => {
    await db.query('DELETE FROM "User" WHERE email LIKE $1', [`${prefix}%`]);
    await db.query('DELETE FROM "Exercise" WHERE id LIKE $1', [`${prefix}%`]);
    await db.end();
  });

  test("two sets logged offline sync once each when the connection returns", async ({
    page,
    context,
  }) => {
    const { workoutId, exerciseName } = await signedInAthleteWithWorkout(
      page,
      db,
      prefix,
    );

    await context.setOffline(true);
    await logSet(page, exerciseName, SET_ONE);
    await logSet(page, exerciseName, SET_TWO);

    await expect(page.getByText("Saved offline, 2 to sync")).toBeVisible();
    await expect(page.getByText("Set 2: 8 reps · 20 lb")).toBeVisible();
    await expect(page.getByText("Waiting to sync")).toHaveCount(SET_TWO);
    expect(await savedSets(db, workoutId)).toEqual([]);

    await context.setOffline(false);

    await expect(page.getByText("All sets synced")).toBeVisible({
      timeout: SYNC_TIMEOUT_MS,
    });
    await expect(page.getByText("Waiting to sync")).toHaveCount(0);
    await expect(page.getByText("Set 2: 8 reps · 20 lb")).toBeVisible();
    const rows = await savedSets(db, workoutId);
    expect(rows.map((row) => row.setNumber)).toEqual([SET_ONE, SET_TWO]);
    // Each set came through the queue, so each has its applied clientId.
    expect(rows.every((row) => row.keyed)).toBe(true);
    // 20 lb, converted on the device: 20 x 0.45359237 = 9.07 kg.
    expect(rows.map((row) => row.weightKg)).toEqual([
      TWENTY_LB_IN_KG,
      TWENTY_LB_IN_KG,
    ]);
  });

  test("a set the server could not receive survives a reload and syncs after it", async ({
    page,
  }) => {
    const { workoutId, exerciseName } = await signedInAthleteWithWorkout(
      page,
      db,
      prefix,
    );
    // The page stays reachable but the server action request fails, as on a weak signal.
    await page.route("**/session", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );

    await logSet(page, exerciseName, SET_ONE);
    await expect(page.getByText("Saved offline, 1 to sync")).toBeVisible();
    expect(await savedSets(db, workoutId)).toEqual([]);

    await page.unroute("**/session");
    await page.reload();

    await expect(page.getByText("All sets synced")).toBeVisible({
      timeout: SYNC_TIMEOUT_MS,
    });
    expect(
      (await savedSets(db, workoutId)).map((row) => row.setNumber),
    ).toEqual([SET_ONE]);
  });
});
