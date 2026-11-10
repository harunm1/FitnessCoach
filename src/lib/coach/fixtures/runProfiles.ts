// Test profiles for running plans (#34), one per situation the builder must handle.
import type { RunProfile } from "../verifyRunning";

export const RUN_PROFILES: Record<string, RunProfile> = {
  newSedentary: {
    runDaysPerWeek: 3,
    activityLevel: "SEDENTARY",
    lastWeekKm: null,
    easyPaceSecPerKm: null,
  },
  activeWithHistory: {
    runDaysPerWeek: 4,
    activityLevel: "ACTIVE",
    lastWeekKm: 20,
    easyPaceSecPerKm: 360,
  },
  physicalJobFiveDays: {
    runDaysPerWeek: 5,
    activityLevel: "PHYSICAL_JOB",
    lastWeekKm: 30,
    easyPaceSecPerKm: 330,
  },
  tinyWeek: {
    // Asked for four days but logged only 2 km: the cap allows two runs.
    runDaysPerWeek: 4,
    activityLevel: "LIGHT",
    lastWeekKm: 2,
    easyPaceSecPerKm: null,
  },
  sevenDays: {
    // More than five run days is capped at five; rest days stay rest days.
    runDaysPerWeek: 7,
    activityLevel: "ACTIVE",
    lastWeekKm: 40,
    easyPaceSecPerKm: 300,
  },
};
