import { randomUUID } from "node:crypto";
import { createEmailVerificationToken } from "better-auth/api";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAuth, type AuthEmail } from "@/lib/auth/core";
import { testDatabase } from "../helpers/database";

const db = testDatabase();
const baseURL = "http://localhost:3000";
const password = "A-long-test-password-14!";
const prefix = randomUUID();
const emails: AuthEmail[] = [];
let auth: ReturnType<typeof createAuth>;
let sequence = 0;
let ip: string;
let email: string;
async function post(
  path: string,
  body: unknown,
  cookie = "",
  origin = baseURL,
) {
  return auth.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        cookie,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}
async function signup(extra: Record<string, unknown> = {}) {
  return post("/sign-up/email", {
    name: "Test Athlete",
    email,
    password,
    callbackURL: "/sign-in",
    ...extra,
  });
}
async function verify() {
  const message = emails.find(
    (item) => item.to === email && item.subject.startsWith("Verify"),
  );
  expect(message).toBeDefined();
  const link = message!.text.match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeDefined();
  return auth.handler(new Request(link!));
}
async function login(value = password) {
  return post("/sign-in/email", { email, password: value });
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((item) => item.split(";", 1)[0])
    .join("; ");
}
async function session(cookie: string) {
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/get-session`, { headers: { cookie } }),
  );
  return response.json();
}

beforeEach(async () => {
  emails.length = 0;
  sequence++;
  ip = `2001:db8:${sequence}:${prefix.slice(0, 4)}::${prefix.slice(4, 8)}`;
  email = `${prefix}-${sequence}@example.test`;
  auth = createAuth(
    db,
    { baseURL, secret: "test-only-auth-secret-at-least-32-characters" },
    async (message) => {
      emails.push(message);
    },
  );
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.$disconnect();
});

describe("Better Auth with PostgreSQL", () => {
  it("creates a FREE user with hashed credentials and rejects an unverified login", async () => {
    const response = await signup({
      tier: "ADMIN",
      trialEndsAt: "2099-01-01T00:00:00Z",
      emailVerified: true,
    });
    expect(response.status).toBe(400);
    expect(await db.user.count({ where: { email } })).toBe(0);
    expect((await signup()).status).toBe(200);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({
      tier: "FREE",
      emailVerified: false,
      trialEndsAt: null,
    });
    const account = await db.account.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(account.password).toBeTruthy();
    expect(account.password).not.toBe(password);
    expect(account.providerId).toBe("credential");
    expect((await login()).status).toBe(403);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it("verifies email, authenticates, sets HttpOnly cookies and invalidates logout", async () => {
    await signup();
    await verify();
    const response = await login();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    const cookie = cookies(response);
    expect((await session(cookie)).user.email).toBe(email);
    expect((await post("/sign-out", {}, cookie)).status).toBe(200);
    expect(await session(cookie)).toBeNull();
  });
  it("prevents an authenticated account from updating tiers or another user", async () => {
    await signup();
    await verify();
    const cookie = cookies(await login());
    const victim = await db.user.create({
      data: { name: "Other Athlete", email: `${prefix}-other@example.test` },
    });
    expect(
      (
        await post(
          "/update-user",
          { tier: "ADMIN", trialEndsAt: "2099-01-01T00:00:00Z" },
          cookie,
        )
      ).status,
    ).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).tier).toBe(
      "FREE",
    );
    expect(
      (
        await post(
          "/update-user",
          { name: "Renamed Athlete", userId: victim.id },
          cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: victim.id } })).name,
    ).toBe("Other Athlete");
    expect((await db.user.findUniqueOrThrow({ where: { email } })).name).toBe(
      "Renamed Athlete",
    );
  });
  it("does not grant a session for a wrong password or invalid verification token", async () => {
    await signup();
    await auth.handler(
      new Request(
        `${baseURL}/api/auth/verify-email?token=not-a-valid-token&callbackURL=/sign-in`,
      ),
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { email } })).emailVerified,
    ).toBe(false);
    await verify();
    expect((await login("a-wrong-password-value")).status).toBe(401);
  });
  it("uses generic signup and recovery responses for existing and missing emails", async () => {
    expect((await signup()).status).toBe(200);
    expect((await signup()).status).toBe(200);
    expect(await db.user.count({ where: { email } })).toBe(1);
    const known = await post("/request-password-reset", {
      email,
      redirectTo: "/reset-password",
    });
    const missing = await post("/request-password-reset", {
      email: `${prefix}-missing@example.test`,
      redirectTo: "/reset-password",
    });
    expect(known.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(await known.json()).toEqual(await missing.json());
  });
  it("resends verification email without signing the user in", async () => {
    await signup();
    emails.length = 0;
    expect(
      (
        await post("/send-verification-email", {
          email,
          callbackURL: "/sign-in",
        })
      ).status,
    ).toBe(200);
    expect(emails).toHaveLength(1);
    await verify();
    await verify();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(true);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it("does not verify an expired email token", async () => {
    await signup();
    const token = await createEmailVerificationToken(
      "test-only-auth-secret-at-least-32-characters",
      email,
      undefined,
      -1,
    );
    await auth.handler(
      new Request(
        `${baseURL}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=/sign-in`,
      ),
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { email } })).emailVerified,
    ).toBe(false);
    expect((await login()).status).toBe(403);
  });
  it("resets a password once and revokes all earlier sessions", async () => {
    await signup();
    await verify();
    const cookie = cookies(await login());
    await post("/request-password-reset", {
      email,
      redirectTo: "/reset-password",
    });
    const message = emails.find(
      (item) => item.to === email && item.subject.startsWith("Reset"),
    )!;
    const link = new URL(message.text.match(/https?:\/\/\S+/)![0]);
    const token = link.pathname.split("/").at(-1)!;
    // The emailed link first passes through Better Auth, then redirects to our form.
    const redirect = await auth.handler(new Request(link));
    const resetURL = new URL(redirect.headers.get("location")!, baseURL);
    const resetToken = resetURL.searchParams.get("token") || token;
    const next = "A-different-test-password-15!";
    expect(
      (await post("/reset-password", { token: resetToken, newPassword: next }))
        .status,
    ).toBe(200);
    expect(await session(cookie)).toBeNull();
    expect((await login()).status).toBe(401);
    expect((await login(next)).status).toBe(200);
    expect(
      (
        await post("/reset-password", {
          token: resetToken,
          newPassword: password,
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
  });
  it("rejects expired reset tokens without changing credentials", async () => {
    await signup();
    await verify();
    await post("/request-password-reset", {
      email,
      redirectTo: "/reset-password",
    });
    const link = new URL(
      emails
        .find((item) => item.subject.startsWith("Reset"))!
        .text.match(/https?:\/\/\S+/)![0],
    );
    await db.verification.updateMany({ data: { expiresAt: new Date(0) } });
    const token = link.pathname.split("/").at(-1)!;
    expect(
      (
        await post("/reset-password", {
          token,
          newPassword: "A-new-expired-password-value",
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect((await login()).status).toBe(200);
  });
  it("rejects expired sessions and cross-origin mutations", async () => {
    await signup();
    await verify();
    const cookie = cookies(await login());
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(0) },
    });
    expect(await session(cookie)).toBeNull();
    expect((await post("/update-user", { name: "Intruder" })).status).toBe(401);
    expect(
      (
        await post(
          "/sign-up/email",
          { name: "Fake", email: `${prefix}-evil@example.test`, password },
          "",
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
  });
  it("rejects untrusted verification redirects and server-side invalid names", async () => {
    expect((await signup({ callbackURL: "https://evil.example" })).status).toBe(
      403,
    );
    expect(
      (await signup({ name: "x".repeat(101) })).status,
    ).toBeGreaterThanOrEqual(400);
  });
  it("persists rate limits and returns 429 when sign-in attempts exceed the limit", async () => {
    let last: Response | undefined;
    for (let attempt = 0; attempt < 11; attempt++) last = await login();
    expect(last!.status).toBe(429);
    expect(await db.rateLimit.count()).toBeGreaterThan(0);
  });
});
