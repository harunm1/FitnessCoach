// Ten fixed profiles for checking the coach (issue #19): different equipment, days a
// week and reported injuries. Every plan for a profile must pass verifyPlan, which
// checks owned equipment, avoided muscles and the number of days. Muscle and equipment
// names are free-exercise-db's, as stored in the Exercise table.
import type { VerifyProfile } from "./verify";

const FULL_GYM = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "kettlebells",
  "e-z curl bar",
];

export const EVAL_PROFILES: { id: string; profile: VerifyProfile }[] = [
  {
    id: "gym-3-days",
    profile: { daysPerWeek: 3, equipment: FULL_GYM, avoidMuscles: [] },
  },
  {
    id: "gym-5-days",
    profile: { daysPerWeek: 5, equipment: FULL_GYM, avoidMuscles: [] },
  },
  {
    id: "gym-4-days-knee",
    profile: {
      daysPerWeek: 4,
      equipment: FULL_GYM,
      avoidMuscles: ["quadriceps"],
    },
  },
  {
    id: "machines-6-days",
    profile: {
      daysPerWeek: 6,
      equipment: ["machine", "cable"],
      avoidMuscles: [],
    },
  },
  {
    id: "dumbbells-3-days",
    profile: { daysPerWeek: 3, equipment: ["dumbbell"], avoidMuscles: [] },
  },
  {
    id: "dumbbells-bands-3-days-shoulder",
    profile: {
      daysPerWeek: 3,
      equipment: ["dumbbell", "bands"],
      avoidMuscles: ["shoulders"],
    },
  },
  {
    id: "dumbbells-1-day-wrist",
    profile: {
      daysPerWeek: 1,
      equipment: ["dumbbell"],
      avoidMuscles: ["forearms"],
    },
  },
  {
    id: "bodyweight-2-days",
    profile: { daysPerWeek: 2, equipment: [], avoidMuscles: [] },
  },
  {
    id: "bodyweight-4-days-back",
    profile: { daysPerWeek: 4, equipment: [], avoidMuscles: ["lower back"] },
  },
  {
    id: "kettlebells-2-days-back-shoulder",
    profile: {
      daysPerWeek: 2,
      equipment: ["kettlebells"],
      avoidMuscles: ["lower back", "shoulders"],
    },
  },
];
