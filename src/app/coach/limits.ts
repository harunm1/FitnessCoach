// The coach message caps (#63): one limiter per server instance, shared by every call of the Server Action.
import { createAttemptLimiter } from "@/lib/coach/attemptLimit";

// Each message can cost two model calls (the safety check and the reply), so one
// account cannot script the action in a loop (security review, 10 Nov).
export const COACH_LIMITS = { perMinute: 5, perDay: 50 };

export const coachAttempts = createAttemptLimiter(COACH_LIMITS);
