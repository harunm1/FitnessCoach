import { z } from "zod";

export const emailSchema = z.email().trim().max(254);
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(100);
export const signUpSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
