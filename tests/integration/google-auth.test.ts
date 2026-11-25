import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createAuth, type AuthEmail } from "@/lib/auth/core";
import { testDatabase } from "../helpers/database";

const db = testDatabase();
const baseURL = "http://localhost:3000";
const prefix = randomUUID();
const realFetch = globalThis.fetch;
const HTTP_OK = 200;
const HTTP_FOUND = 302;
const TOKEN_LIFETIME_SECONDS = 3600;
const TWO_SIGN_INS = 2;
const IP_PART_A = [0, 4] as const;
const IP_PART_B = [4, 8] as const;
let auth: ReturnType<typeof createAuth>;
let sequence = 0;
let ip: string;
let email: string;
let sub: string;
const sent: AuthEmail[] = [];

function b64(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

// Stands in for Google's token endpoint only; every other request is real.
function fakeGoogle(claims: { email_verified: boolean; email?: string }) {
  const idToken = `${b64({ alg: "RS256", kid: "test" })}.${b64({
    iss: "https://accounts.google.com",
    aud: "test-client-id",
    sub,
    email,
    name: "Gina Google",
    picture: "https://example.test/g.png",
    ...claims,
  })}.signature`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith("https://oauth2.googleapis.com/token"))
        return Response.json({
          access_token: "fake-access",
          refresh_token: "fake-refresh",
          expires_in: TOKEN_LIFETIME_SECONDS,
          scope: "openid email profile",
          token_type: "Bearer",
          id_token: idToken,
        });
      return realFetch(input, init);
    }),
  );
}

async function googleCallback() {
  const start = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/social`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseURL,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/account",
        errorCallbackURL: "/sign-in?provider=google",
      }),
    }),
  );
  expect(start.status).toBe(HTTP_OK);
  const { url } = (await start.json()) as { url: string };
  const authorize = new URL(url);
  expect(authorize.origin + authorize.pathname).toBe(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  expect(authorize.searchParams.get("redirect_uri")).toBe(
    `${baseURL}/api/auth/callback/google`,
  );
  const cookie = start.headers
    .getSetCookie()
    .map((item) => item.split(";", 1)[0])
    .join("; ");
  return auth.handler(
    new Request(
      `${baseURL}/api/auth/callback/google?code=fake-code&state=${authorize.searchParams.get("state")}`,
      { headers: { cookie, "x-forwarded-for": ip } },
    ),
  );
}

function location(response: Response) {
  return new URL(response.headers.get("location") ?? "", baseURL);
}

beforeEach(() => {
  sent.length = 0;
  sequence++;
  ip = `2001:db8:${sequence}:${prefix.slice(...IP_PART_A)}::${prefix.slice(...IP_PART_B)}`;
  email = `${prefix}-g${sequence}@example.test`;
  sub = `google-sub-${prefix}-${sequence}`;
  auth = createAuth(
    db,
    {
      baseURL,
      secret: "test-only-auth-secret-at-least-32-characters",
      google: { clientId: "test-client-id", clientSecret: "test-secret" },
    },
    async (mail) => {
      sent.push(mail);
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.$disconnect();
});

describe("Sign in with Google", () => {
  it("creates a FREE user and a google account row, and starts a session", async () => {
    fakeGoogle({ email_verified: true });
    const response = await googleCallback();
    expect(response.status).toBe(HTTP_FOUND);
    expect(location(response).pathname).toBe("/account");
    expect(response.headers.getSetCookie().join(";")).toContain(
      "better-auth.session_token",
    );
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({
      tier: "FREE",
      trialEndsAt: null,
      emailVerified: true,
      name: "Gina Google",
    });
    const accounts = await db.account.findMany({ where: { userId: user.id } });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      providerId: "google",
      accountId: sub,
      password: null,
    });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("signs the same Google account in again without a second user or account", async () => {
    fakeGoogle({ email_verified: true });
    await googleCallback();
    expect((await googleCallback()).status).toBe(HTTP_FOUND);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await db.account.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(
      TWO_SIGN_INS,
    );
  });

  it("links to an existing user whose email is verified, keeping their tier", async () => {
    const existing = await db.user.create({
      data: {
        name: "Existing Athlete",
        email,
        emailVerified: true,
        tier: "PRO",
        accounts: {
          create: {
            accountId: randomUUID(),
            providerId: "credential",
            password: "not-a-real-hash",
          },
        },
      },
    });
    fakeGoogle({ email_verified: true });
    const response = await googleCallback();
    expect(location(response).pathname).toBe("/account");
    expect(await db.user.count({ where: { email } })).toBe(1);
    const accounts = await db.account.findMany({
      where: { userId: existing.id },
      orderBy: { providerId: "asc" },
    });
    expect(accounts.map((item) => item.providerId)).toEqual([
      "credential",
      "google",
    ]);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: existing.id } })).tier,
    ).toBe("PRO");
  });

  it("does not link to a user whose email was never verified", async () => {
    const existing = await db.user.create({
      data: { name: "Unverified", email, emailVerified: false },
    });
    fakeGoogle({ email_verified: true });
    const response = await googleCallback();
    expect(location(response).pathname).toBe("/sign-in");
    expect(location(response).searchParams.get("provider")).toBe("google");
    expect(location(response).searchParams.get("error")).toBe(
      "account_not_linked",
    );
    expect(response.headers.getSetCookie().join(";")).not.toContain(
      "session_token=",
    );
    expect(await db.account.count({ where: { userId: existing.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: existing.id } })).toBe(0);
  });

  it("creates nothing when Google reports the email as unverified", async () => {
    fakeGoogle({ email_verified: false });
    const response = await googleCallback();
    expect(location(response).pathname).toBe("/sign-in");
    expect(location(response).searchParams.get("error")).toBe(
      "email_not_verified",
    );
    expect(location(response).searchParams.get("provider")).toBe("google");
    expect(response.headers.getSetCookie().join(";")).not.toContain(
      "session_token=",
    );
    // No user row, no Google account and no verification email for an address
    // the Google identity has not proven it owns.
    expect(await db.user.count({ where: { email } })).toBe(0);
    expect(await db.account.count({ where: { accountId: sub } })).toBe(0);
    expect(sent.filter((mail) => mail.to === email)).toHaveLength(0);
  });

  it("does not link a verified user when Google says the email is unverified", async () => {
    const existing = await db.user.create({
      data: { name: "Verified", email, emailVerified: true },
    });
    fakeGoogle({ email_verified: false });
    await googleCallback();
    expect(await db.account.count({ where: { userId: existing.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: existing.id } })).toBe(0);
  });
});
