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
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const symptoms =
    "(?:pain(?:ful)?|hurt(?:s|ing)?|sore|ache(?:s)?|aching|injur(?:y|ies|ed)|strain(?:ed|s)?|tweak(?:ed|s)?|trouble|problem)";
  const painPattern = new RegExp(`\\b${symptoms}\\b`, "i");
  const beforeBack = new RegExp(
    `\\b${symptoms}(?:\\s+(?:in|on|my|the|a)){0,3}\\s*$`,
    "i",
  );
  const afterBack = new RegExp(
    `^\\s+(?:(?:is|feels?|has|been|really|very|still)\\s+){0,3}${symptoms}\\b`,
    "i",
  );
  const clauses = normalized.split(/\b(?:but|however|except)\b|[,.;!?]/i);

  return JOINTS.filter((joint) => {
    const jointPattern =
      joint === "lower back"
        ? /\b(?:lower[\s-]+back|back)\b/gi
        : new RegExp(`\\b${joint}s?\\b`, "gi");
    return clauses.some((clause) => {
      const affirmed = clause.replace(
        new RegExp(
          `\\b(?:no|not|without|denies?|none)\\s+(?:any\\s+)?${symptoms}\\b`,
          "gi",
        ),
        " ",
      );
      for (const match of affirmed.matchAll(jointPattern)) {
        const before = affirmed.slice(
          Math.max(0, match.index - 24),
          match.index,
        );
        const after = affirmed.slice(
          match.index + match[0].length,
          match.index + match[0].length + 24,
        );
        if (joint === "lower back" && match[0] === "back") {
          if (/^\s+squats?\b/i.test(after)) continue;
          if (!beforeBack.test(before) && !afterBack.test(after)) continue;
        }
        const negated =
          /\b(?:no|not|without|denies?|none)\b[^,.;]*$/i.test(before) ||
          /^\s*(?:no|not|without|denies?|none)\b/i.test(after);
        if (painPattern.test(`${before} ${match[0]} ${after}`) && !negated)
          return true;
      }
      return false;
    });
  });
}
