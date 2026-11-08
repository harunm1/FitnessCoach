import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { testDatabaseURL } from "./tests/helpers/database-url";

const baseURL = "http://127.0.0.1:13100";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "tsx tests/helpers/mail-server.ts",
      url: "http://127.0.0.1:18027/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 13100",
      url: `${baseURL}/sign-in`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: testDatabaseURL(),
        BETTER_AUTH_URL: baseURL,
        BETTER_AUTH_SECRET:
          "fitnesscoach-browser-test-secret-never-use-in-production",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "11026",
        SMTP_SECURE: "false",
        SMTP_FROM: "FitnessCoach <noreply@example.test>",
        SMTP_USER: "",
        SMTP_PASSWORD: "",
        // Browser fixtures must never inherit a developer's Stripe sandbox keys.
        STRIPE_SECRET_KEY: "",
        STRIPE_PRICE_ID: "",
        STRIPE_MONTHLY_PRICE_ID: "",
        STRIPE_YEARLY_PRICE_ID: "",
        STRIPE_WEBHOOK_SECRET: "",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
