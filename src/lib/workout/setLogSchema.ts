import { z } from "zod";

const optionalWeightSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number()
    .positive()
    .max(9999.99)
    .refine((value) => Number.isInteger(value * 100), {
      message: "Weight can have at most two decimal places.",
    })
    .optional(),
);

export const setLogSchema = z.object({
  reps: z.coerce.number().int().min(1).max(30),
  weightKg: optionalWeightSchema,
});

export type SetLogActionState = {
  status: "idle" | "error" | "success";
  message: string;
};
