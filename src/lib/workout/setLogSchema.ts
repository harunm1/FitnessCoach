import { z } from "zod";

const optionalWeightSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number()
    .positive()
    .max(9999.99)
    // value * 100 is not exact in floating point (5.1 * 100 = 509.99...), so compare with a tolerance
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: "Weight can have at most two decimal places.",
    })
    .optional(),
);

export const setLogSchema = z.object({
  setNumber: z.coerce.number().int().min(1).max(6),
  reps: z.coerce.number().int().min(1).max(30),
  weightKg: optionalWeightSchema,
});

export type SetLogActionState = {
  status: "idle" | "error" | "success";
  message: string;
};
