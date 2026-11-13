import { z } from "zod";
import { Goal, Level } from "../../generated/prisma/enums";

export const equipmentOptions = [
  { value: "body only", label: "Bodyweight only" },
  { value: "dumbbell", label: "Dumbbells" },
  { value: "barbell", label: "Barbell" },
  { value: "cable", label: "Cable machine" },
  { value: "machine", label: "Weight machines" },
  { value: "kettlebells", label: "Kettlebells" },
] as const;

export const quizProfileSchema = z.object({
  goal: z.enum(Goal),
  level: z.enum(Level),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  equipment: z
    .array(
      z.enum(
        equipmentOptions.map((option) => option.value) as [string, ...string[]],
      ),
    )
    .min(1, "Select at least one equipment option."),
  injuries: z.string().trim().max(500),
});

export type QuizProfileInput = z.infer<typeof quizProfileSchema>;

export type QuizActionState = {
  status: "idle" | "error" | "success";
  message: string;
};
