import type { ExerciseJointMapping } from "./jointSubstitutions";

export const draftExerciseJointMappings = {
  Barbell_Squat: {
    pattern: "squat",
    joints: ["knee", "hip", "ankle", "lower back", "shoulder", "wrist"],
  },
  "Barbell_Bench_Press_-_Medium_Grip": {
    pattern: "horizontal push",
    joints: ["shoulder", "elbow", "wrist"],
  },
  Bent_Over_Barbell_Row: {
    pattern: "horizontal pull",
    joints: ["shoulder", "elbow", "wrist", "hip", "lower back"],
  },
  Pullups: { pattern: "vertical pull", joints: ["shoulder", "elbow", "wrist"] },
  Barbell_Deadlift: {
    pattern: "hinge",
    joints: ["hip", "knee", "ankle", "lower back", "shoulder", "wrist"],
  },
  Dumbbell_Lunges: {
    pattern: "lunge",
    joints: ["knee", "hip", "ankle", "lower back", "wrist"],
  },
  Standing_Military_Press: {
    pattern: "vertical push",
    joints: ["shoulder", "elbow", "wrist", "lower back"],
  },
  Crunches: { pattern: "core", joints: ["lower back"] },
  Bodyweight_Squat: {
    pattern: "squat",
    joints: ["knee", "hip", "ankle", "lower back"],
  },
  Dumbbell_Bench_Press: {
    pattern: "horizontal push",
    joints: ["shoulder", "elbow", "wrist"],
  },
  Dumbbell_Shoulder_Press: {
    pattern: "vertical push",
    joints: ["shoulder", "elbow", "wrist"],
  },
  "One-Arm_Dumbbell_Row": {
    pattern: "horizontal pull",
    joints: ["shoulder", "elbow", "wrist", "hip", "lower back", "knee"],
  },
  Dumbbell_Squat: {
    pattern: "squat",
    joints: ["knee", "hip", "ankle", "lower back", "wrist"],
  },
  Front_Squat_Clean_Grip: {
    pattern: "squat",
    joints: [
      "knee",
      "hip",
      "ankle",
      "lower back",
      "shoulder",
      "elbow",
      "wrist",
    ],
  },
  Romanian_Deadlift: {
    pattern: "hinge",
    joints: ["hip", "knee", "lower back", "shoulder", "wrist"],
  },
  "Stiff-Legged_Dumbbell_Deadlift": {
    pattern: "hinge",
    joints: ["hip", "knee", "lower back", "shoulder", "wrist"],
  },
  Butt_Lift_Bridge: { pattern: "hinge", joints: ["hip", "knee", "lower back"] },
  Barbell_Walking_Lunge: {
    pattern: "lunge",
    joints: ["knee", "hip", "ankle", "lower back", "shoulder", "wrist"],
  },
  Barbell_Lunge: {
    pattern: "lunge",
    joints: ["knee", "hip", "ankle", "lower back", "shoulder", "wrist"],
  },
  Dumbbell_Rear_Lunge: {
    pattern: "lunge",
    joints: ["knee", "hip", "ankle", "lower back", "wrist"],
  },
  "Incline_Push-Up": {
    pattern: "horizontal push",
    joints: ["shoulder", "elbow", "wrist"],
  },
  "Barbell_Incline_Bench_Press_-_Medium_Grip": {
    pattern: "horizontal push",
    joints: ["shoulder", "elbow", "wrist"],
  },
  "Dumbbell_One-Arm_Shoulder_Press": {
    pattern: "vertical push",
    joints: ["shoulder", "elbow", "wrist", "lower back"],
  },
  Barbell_Shoulder_Press: {
    pattern: "vertical push",
    joints: ["shoulder", "elbow", "wrist"],
  },
  "Bent_Over_Two-Dumbbell_Row": {
    pattern: "horizontal pull",
    joints: ["shoulder", "elbow", "wrist", "hip", "lower back"],
  },
  "Bent_Over_Two-Dumbbell_Row_With_Palms_In": {
    pattern: "horizontal pull",
    joints: ["shoulder", "elbow", "wrist", "hip", "lower back"],
  },
  "Chin-Up": {
    pattern: "vertical pull",
    joints: ["shoulder", "elbow", "wrist"],
  },
  "V-Bar_Pullup": {
    pattern: "vertical pull",
    joints: ["shoulder", "elbow", "wrist"],
  },
  Flat_Bench_Lying_Leg_Raise: {
    pattern: "core",
    joints: ["hip", "lower back"],
  },
  Reverse_Crunch: { pattern: "core", joints: ["hip", "lower back"] },
} as const satisfies Record<string, ExerciseJointMapping>;
