import { z } from "zod";

export const MIN_SET_WEIGHT_KG = 0.25;

const optionalWeightSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number()
    // Under a quarter kilogram is not a load (the smallest plate step shown): a typed
    // 0.02 reached the Progress page as "0.02 kg" (B2).
    .min(
      MIN_SET_WEIGHT_KG,
      "That weight is too small to be a load: the smallest is 0.25 kg (0.55 lb).",
    )
    .max(9999.99)
    // value * 100 is not exact in floating point (5.1 * 100 = 509.99...), so compare with a tolerance
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: "Weight can have at most two decimal places.",
    })
    .optional(),
);

const optionalPainSchema = z.preprocess(
  (value) =>
    value === null || (typeof value === "string" && value.trim() === "")
      ? undefined
      : value,
  z.coerce.number().int().min(0).max(10).optional(),
);

export const setLogSchema = z.object({
  setNumber: z.coerce.number().int().min(1).max(6),
  reps: z.coerce.number().int().min(1).max(30),
  weightKg: optionalWeightSchema,
  painDuringSession: optionalPainSchema,
  painNextMorning: optionalPainSchema,
});

export type SetLogActionState = {
  status: "idle" | "error" | "success";
  message: string;
};
