import { z } from "zod";

const distanceSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number()
    .positive()
    .max(9999.99)
    // value * 100 is not exact in floating point (5.1 * 100 = 509.99...), so compare with a tolerance
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: "Distance can have at most two decimal places.",
    }),
);

export const runMetricsSchema = z
  .object({
    distanceKm: distanceSchema,
    durationMinutes: z.coerce.number().int().min(0).max(1440),
    durationSeconds: z.coerce.number().int().min(0).max(59),
  })
  .superRefine((metrics, context) => {
    if (metrics.durationMinutes === 0 && metrics.durationSeconds === 0) {
      context.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "Enter a run duration greater than zero.",
      });
    }
  });

export type RunMetricsActionState = {
  status: "idle" | "error";
  message: string;
};
