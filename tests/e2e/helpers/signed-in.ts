import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import type { Client } from "pg";

const ORIGIN = "http://127.0.0.1:13100";
const ADDRESS_GROUP_LENGTH = 4;
// Accepts "http://127.0.0.1:13100/account"; rejects ".../account/photos".
// https://regex101.com/?regex=%5C%2Faccount%24&testString=http%3A%2F%2F127.0.0.1%3A13100%2Faccount
const ACCOUNT_URL = /\/account$/;

// Signs up a fresh, verified user and signs in through the form, so a spec can open the
// signed-in pages. `label` names the spec in the email and gives it its own forwarded
// address, which keeps it out of the sign-in rate limit (as photos.spec.ts does).
export async function signInFreshUser(
  page: Page,
  db: Client,
  { label, lastAddressGroup }: { label: string; lastAddressGroup: number },
) {
  const email = `${label}-${randomUUID()}@example.test`;
  const password = "Fresh-athlete-password-123!";
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `2001:db8:${randomUUID().slice(0, ADDRESS_GROUP_LENGTH)}::${lastAddressGroup}`,
  });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: ORIGIN },
    data: { name: "Fresh Athlete", email, password },
  });
  expect(signup.ok()).toBe(true);
  await db.query('UPDATE "User" SET "emailVerified" = true WHERE email = $1', [
    email,
  ]);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(ACCOUNT_URL);
}
