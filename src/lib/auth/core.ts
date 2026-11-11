import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { displayNameSchema } from "./validation";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { PrismaClient } from "@/generated/prisma/client";

export type AuthEmail = { to: string; subject: string; text: string };
export type SendAuthEmail = (email: AuthEmail) => Promise<void>;
export type AuthConfig = { baseURL: string; secret: string };

// The injectable database and email sender keep integration tests on an isolated DB.
export function createAuth(
  database: PrismaClient,
  config: AuthConfig,
  sendEmail: SendAuthEmail,
  backgroundTask?: (task: Promise<unknown>) => void,
) {
  return betterAuth({
    appName: "FitnessCoach",
    baseURL: config.baseURL,
    secret: config.secret,
    onAPIError: { errorURL: `${config.baseURL}/verify-email` },
    trustedOrigins: [config.baseURL],
    database: prismaAdapter(database, {
      provider: "postgresql",
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) =>
        sendEmail({
          to: user.email,
          subject: "Reset your FitnessCoach password",
          text: `Reset your password using this link (expires in one hour):\n${url}\n\nIf you did not request this, ignore this email.`,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: ({ user, url }) =>
        sendEmail({
          to: user.email,
          subject: "Verify your FitnessCoach email",
          text: `Verify your email using this link (expires in one hour):\n${url}\n\nIf you did not create an account, ignore this email.`,
        }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const name = displayNameSchema.safeParse(user.name);
            if (!name.success)
              throw new APIError("BAD_REQUEST", {
                message: "Name must contain 1–100 characters.",
              });
            return {
              data: {
                ...user,
                name: name.data,
                tier: "FREE",
                trialEndsAt: null,
              },
            };
          },
        },
      },
    },
    user: {
      additionalFields: {
        tier: {
          type: ["FREE", "TRIAL", "PRO", "ADMIN"],
          defaultValue: "FREE",
          input: false,
        },
        trialEndsAt: { type: "date", required: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 5 },
      },
    },
    advanced: {
      disableOriginCheck: false,
      useSecureCookies: new URL(config.baseURL).protocol === "https:",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ...(backgroundTask
        ? { backgroundTasks: { handler: backgroundTask } }
        : {}),
    },
  });
}
