import { afterEach, describe, expect, it, vi } from "vitest";
import { readAuthConfig, readMailConfig } from "./config";
import { signUpSchema } from "./validation";

import { testDatabaseURL } from "../../../tests/helpers/database-url";

afterEach(() => vi.unstubAllEnvs());

const secret = "a-test-only-secret-of-at-least-32-characters";
describe("auth configuration", () => {
  it("accepts local HTTP and deployed HTTPS origins", () => {
    expect(
      readAuthConfig({
        BETTER_AUTH_SECRET: secret,
        BETTER_AUTH_URL: "http://localhost:3000",
      }).baseURL,
    ).toBe("http://localhost:3000");
    expect(
      readAuthConfig({
        BETTER_AUTH_SECRET: secret,
        BETTER_AUTH_URL: "https://fitness.example",
      }).baseURL,
    ).toBe("https://fitness.example");
  });
  it("rejects missing secrets, remote HTTP, URL credentials and non-origin URLs", () => {
    for (const url of [
      "http://fitness.example",
      "https://user:pass@fitness.example",
      "https://fitness.example/path",
      "https://fitness.example/?x=1",
      "https://fitness.example/#x",
    ]) {
      expect(() =>
        readAuthConfig({ BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: url }),
      ).toThrow();
    }
    expect(() =>
      readAuthConfig({ BETTER_AUTH_URL: "http://localhost:3000" }),
    ).toThrow();
  });
  it("validates SMTP settings without contacting a mail server", () => {
    const env = {
      SMTP_HOST: "localhost",
      SMTP_FROM: "FitnessCoach <noreply@fitnesscoach.local>",
      SMTP_PORT: "1025",
    };
    expect(readMailConfig(env)).toMatchObject({
      port: 1025,
      secure: false,
      auth: undefined,
    });
    expect(() => readMailConfig({ ...env, SMTP_PORT: "invalid" })).toThrow();
    expect(() => readMailConfig({ ...env, SMTP_SECURE: "no" })).toThrow();
    expect(() => readMailConfig({ ...env, SMTP_USER: "only-user" })).toThrow();
  });
  it("requires a valid email, name and password for signup", () => {
    expect(
      signUpSchema.safeParse({
        name: "Sam",
        email: "sam@example.test",
        password: "a-long-test-password",
      }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({ name: " ", email: "invalid", password: "short" })
        .success,
    ).toBe(false);
  });
});

describe("test database safety", () => {
  it("rejects unset URLs and a development database", () => {
    vi.stubEnv("TEST_DATABASE_URL", "");
    expect(() => testDatabaseURL()).toThrow("TEST_DATABASE_URL");
    vi.stubEnv("TEST_DATABASE_URL", "postgresql://localhost:5432/fitnesscoach");
    expect(() => testDatabaseURL()).toThrow("dedicated PostgreSQL");
  });
  it("accepts an explicitly configured isolated database", () => {
    const url = "postgresql://localhost:15432/fitnesscoach_test";
    vi.stubEnv("TEST_DATABASE_URL", url);
    expect(testDatabaseURL()).toBe(url);
  });
});
