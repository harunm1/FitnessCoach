export const JOINTS = [
  "knee",
  "hip",
  "lower back",
  "shoulder",
  "elbow",
  "wrist",
  "ankle",
] as const;

export type Joint = (typeof JOINTS)[number];

export type MovementPattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "horizontal push"
  | "vertical push"
  | "horizontal pull"
  | "vertical pull"
  | "core";

export type ExerciseJointMapping = {
  pattern: MovementPattern;
  joints: readonly Joint[];
};

export function findJointSubstitution(
  originalId: string,
  candidateIds: readonly string[],
  reportedJoints: readonly Joint[],
  mapping: Readonly<Record<string, ExerciseJointMapping | undefined>>,
): string | undefined {
  const original = Object.hasOwn(mapping, originalId)
    ? mapping[originalId]
    : undefined;
  if (
    !original ||
    !original.joints.some((joint) => reportedJoints.includes(joint))
  ) {
    return undefined;
  }

  return candidateIds.find((candidateId) => {
    if (candidateId === originalId || !Object.hasOwn(mapping, candidateId)) {
      return false;
    }
    const candidate = mapping[candidateId];
    return (
      candidate !== undefined &&
      candidate.pattern === original.pattern &&
      !candidate.joints.some((joint) => reportedJoints.includes(joint))
    );
  });
}

export function parseReportedJoints(text: string): Joint[] {
  const normalized = text.toLowerCase();
  const painPattern =
    /\b(?:pain|hurts?|sore|ache|aches|aching|injur(?:y|ies)?|trouble|problem)\b/i;

  return JOINTS.filter((joint) => {
    const jointPattern =
      joint === "lower back"
        ? /\blower[\s-]+back\b/i
        : new RegExp(`\\b${joint}\\b`, "i");
    const match = jointPattern.exec(normalized);
    if (!match) return false;

    const before = normalized.slice(Math.max(0, match.index - 24), match.index);
    const after = normalized.slice(
      match.index + match[0].length,
      match.index + match[0].length + 24,
    );
    const context = `${before} ${match[0]} ${after}`;
    const negated =
      /\b(?:no|not|without|denies?|none)\b[^,.;]*$/i.test(before) ||
      /^\s*(?:no|not|without|denies?|none)\b/i.test(after);

    return painPattern.test(context) && !negated;
  });
}
