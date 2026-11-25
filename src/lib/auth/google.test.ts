import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createAuth } from "./core";
import { readGoogleConfig } from "./google";

const secret = "a-test-only-secret-of-at-least-32-characters";
const baseURL = "http://localhost:3000";
const send = async () => {};
// Building the auth object never touches the database, so a stub is enough.
const database = {} as PrismaClient;

describe("readGoogleConfig", () => {
  it("returns the credentials only when both variables are set", () => {
    expect(
      readGoogleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }),
    ).toEqual({ clientId: "id", clientSecret: "s" });
  });

  it.each([
    ["neither", {}],
    ["only the id", { GOOGLE_CLIENT_ID: "id" }],
    ["only the secret", { GOOGLE_CLIENT_SECRET: "s" }],
    ["blank values", { GOOGLE_CLIENT_ID: " ", GOOGLE_CLIENT_SECRET: "" }],
  ])("returns undefined with %s", (_label, env) => {
    expect(readGoogleConfig(env)).toBeUndefined();
  });

  it("trims whitespace pasted around the values", () => {
    expect(
      readGoogleConfig({
        GOOGLE_CLIENT_ID: " id \n",
        GOOGLE_CLIENT_SECRET: "\ts ",
      }),
    ).toEqual({ clientId: "id", clientSecret: "s" });
  });
});

describe("createAuth with Google", () => {
  it("boots without Google and registers no provider", () => {
    const auth = createAuth(database, { baseURL, secret }, send);
    expect(auth.options.socialProviders?.google).toBeUndefined();
  });

  it("registers Google only when credentials are passed", () => {
    const auth = createAuth(
      database,
      { baseURL, secret, google: { clientId: "id", clientSecret: "s" } },
      send,
    );
    expect(auth.options.socialProviders?.google).toMatchObject({
      clientId: "id",
      clientSecret: "s",
      requireEmailVerification: true,
    });
  });

  it("links only to a locally verified user and never trusts a provider blindly", () => {
    const auth = createAuth(
      database,
      { baseURL, secret, google: { clientId: "id", clientSecret: "s" } },
      send,
    );
    const linking = auth.options.account?.accountLinking;
    expect(linking?.requireLocalEmailVerified).toBe(true);
    expect(linking?.trustedProviders).toEqual([]);
    expect(linking?.allowDifferentEmails).toBe(false);
  });
});
