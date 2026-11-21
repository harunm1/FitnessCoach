export type PainTrafficState = "repeat" | "hold" | "stop";

export type PainTrafficResult = {
  state: PainTrafficState;
  reason: string;
};

// CONSERVATIVE general-use thresholds, extrapolated from a single Achilles
// tendinopathy trial; they are not validated for every joint or exercise.
// Silbernagel KG, et al. Br J Sports Med. 2007.
// https://doi.org/10.1136/bjsm.2006.030732
export const PAIN_TRAFFIC_THRESHOLDS = {
  repeatMax: 2,
  holdMin: 3,
  holdMax: 5,
  stopMin: 6,
  scoreMax: 10,
} as const;

export function painTrafficLight(
  painDuringSession: number,
  painNextMorning: number,
): PainTrafficResult {
  for (const score of [painDuringSession, painNextMorning]) {
    if (
      !Number.isInteger(score) ||
      score < 0 ||
      score > PAIN_TRAFFIC_THRESHOLDS.scoreMax
    ) {
      throw new RangeError("Pain scores must be integers from 0 to 10.");
    }
  }

  const score = Math.max(painDuringSession, painNextMorning);

  if (score >= PAIN_TRAFFIC_THRESHOLDS.stopMin) {
    return {
      state: "stop",
      reason:
        "Pain reached the conservative stop range; stop the exercise and consult a qualified health professional.",
    };
  }

  if (score >= PAIN_TRAFFIC_THRESHOLDS.holdMin) {
    return {
      state: "hold",
      reason:
        "Pain reached the conservative hold range; do not increase load and reassess before continuing.",
    };
  }

  return {
    state: "repeat",
    reason:
      "Pain is in the conservative repeat range; continue only if symptoms remain controlled.",
  };
}
