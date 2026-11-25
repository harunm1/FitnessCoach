// What a queued set from the device must look like before the server writes it (D31).
// The set fields reuse the form's rules; the queue adds its key and the workout it is for.
import { z } from "zod";
import { setLogSchema } from "./setLogSchema";

const EXERCISE_ID_MAX_LENGTH = 191;

export const queuedSetSchema = setLogSchema.extend({
  clientId: z.uuid(),
  workoutId: z.number().int().positive(),
  exerciseId: z.string().min(1).max(EXERCISE_ID_MAX_LENGTH),
});

export type QueuedSetInput = z.infer<typeof queuedSetSchema>;
