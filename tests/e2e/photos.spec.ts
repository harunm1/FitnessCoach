import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import sharp from "sharp";
import { testDatabaseURL } from "../helpers/database-url";

// Vercel rejects request bodies over 4.5 MB (D3 in docs/ARCHITECTURE.md).
const VERCEL_LIMIT = 4.5 * 1000 * 1000;

// A phone-sized photo full of noise, so it can't compress below the limit.
async function largePhoto() {
  const width = 4000;
  const height = 3000;
  return sharp(randomBytes(width * height * 3), {
    raw: { width, height, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
}

test("a photo over Vercel's 4.5 MB limit is shrunk in the browser and reaches the server", async ({
  page,
  request,
}) => {
  const db = new Client({ connectionString: testDatabaseURL() });
  const email = `photos-browser-${randomUUID()}@example.test`;
  const password = "Photos-browser-password-123!";
  await db.connect();
  try {
    const signup = await request.post("/api/auth/sign-up/email", {
      headers: { origin: "http://127.0.0.1:13100" },
      data: { name: "Photo Athlete", email, password },
    });
    expect(signup.ok()).toBe(true);
    // Verification delivery is covered by auth.spec.ts.
    await db.query(
      'UPDATE "User" SET "emailVerified" = true WHERE email = $1',
      [email],
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);

    const photo = await largePhoto();
    expect(photo.length).toBeGreaterThan(VERCEL_LIMIT);

    await page.goto("/progress/photos");
    await page.locator('input[name="photo"]').setInputFiles({
      name: "IMG_large.jpg",
      mimeType: "image/jpeg",
      buffer: photo,
    });
    await page.getByRole("button", { name: "Upload photo" }).click();

    // The browser tests run without R2, so saving stops at storage. Getting
    // this message means the shrunk photo passed Next's 4,500,000-byte body
    // limit and the server read it as an image under 4 MB. Sent unshrunk, it
    // would have been refused before reaching the action.
    // (The gallery shows its own "can't be shown" alert without R2, so this
    // looks for the upload form's message by its text.)
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
