import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { testDatabaseURL } from "../helpers/database-url";

// The webcam path (D39) with Chromium's fake camera: the browser answers
// getUserMedia with a generated test pattern and no permission prompt, so the
// real preview, snapshot and stop code run, with no hardware.
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["camera"],
});

async function signIn(page: Page, db: Client, email: string) {
  const password = "Camera-browser-password-123!";
  // A separate address keeps this test apart from the others' sign-in limit,
  // like photos.spec.ts.
  const ip = `2001:db8:${randomUUID().slice(0, 4)}::3`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: "http://127.0.0.1:13100" },
    data: { name: "Camera Athlete", email, password },
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

// Remembers every stream the page was given, so the test can look at its tracks.
async function recordStreams(page: Page) {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    (window as unknown as { __streams: MediaStream[] }).__streams = streams;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
}

const trackStates = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __streams: MediaStream[] }).__streams.flatMap(
      (stream) => stream.getTracks().map((track) => track.readyState),
    ),
  );

test("the webcam preview takes a photo, hands it to the form and switches the camera off", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  const email = `camera-browser-${randomUUID()}@example.test`;
  await db.connect();
  try {
    await recordStreams(page);
    await signIn(page, db, email);
    await page.goto("/progress/photos");

    // Nothing asks for the camera before the button is tapped.
    expect(await trackStates(page)).toEqual([]);

    await page.getByRole("button", { name: "Take photo" }).click();
    const dialog = page.getByRole("dialog", { name: "Camera" });
    await expect(dialog).toBeVisible();
    // The fake camera is live and shows a picture.
    await expect
      .poll(() =>
        page
          .getByLabel("Live camera preview")
          .evaluate((video: HTMLVideoElement) => video.videoWidth),
      )
      .toBeGreaterThan(0);
    expect(await trackStates(page)).toEqual(["live"]);

    await dialog.getByRole("button", { name: "Capture" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText(
      /Photo ready: camera-\d+\.jpg/,
    );
    // The camera light is off again.
    expect(await trackStates(page)).toEqual(["ended"]);

    // The photo goes to the same action as a chosen file. The browser tests
    // run without R2, so saving stops at storage; this message shows the
    // photo reached the server as an image (the file input is still empty).
    await page.getByRole("button", { name: "Upload photo" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Photos can't be saved right now. Try again later.",
      }),
    ).toBeVisible();
  } finally {
    try {
      await db.query('DELETE FROM "User" WHERE email = $1', [email]);
    } finally {
      await db.end();
    }
  }
});

test("closing the preview switches the camera off", async ({ page }) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  const email = `camera-close-${randomUUID()}@example.test`;
  await db.connect();
  try {
    await recordStreams(page);
    await signIn(page, db, email);
    await page.goto("/progress/photos");

    await page.getByLabel("Form photo").check();
    await page.getByRole("button", { name: "Take photo" }).click();
    const dialog = page.getByRole("dialog", { name: "Camera" });
    await expect(dialog).toBeVisible();
    expect(await trackStates(page)).toEqual(["live"]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(await trackStates(page)).toEqual(["ended"]);
    // Leaving the page with the preview open is covered by
    // CameraCapture.test.tsx; a new page has no streams to look at here.
  } finally {
    try {
      await db.query('DELETE FROM "User" WHERE email = $1', [email]);
    } finally {
      await db.end();
    }
  }
});

test("a refused camera falls back to the file picker with a plain message", async ({
  page,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  const email = `camera-denied-${randomUUID()}@example.test`;
  await db.connect();
  try {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await signIn(page, db, email);
    await page.goto("/progress/photos");

    await page.getByRole("button", { name: "Take photo" }).click();
    // The gallery shows its own "can't be shown" alert without R2, so this
    // looks for the camera's message by its text.
    await expect(
      page.getByRole("alert").filter({
        hasText:
          "Camera access was blocked. Choose a photo from your files instead.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Camera" })).toBeHidden();
    // The file picker is still there and still required.
    await expect(page.locator('input[name="photo"]')).toBeVisible();
    await expect(page.locator('input[name="photo"]')).toHaveAttribute(
      "required",
      "",
    );
  } finally {
    try {
      await db.query('DELETE FROM "User" WHERE email = $1', [email]);
    } finally {
      await db.end();
    }
  }
});
