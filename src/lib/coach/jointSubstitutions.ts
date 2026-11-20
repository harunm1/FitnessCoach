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
