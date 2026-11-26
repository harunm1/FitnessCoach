// Seeds the exercise library from free-exercise-db (public domain, docs/RESEARCH.md)
// and optional local tier logins, so everyone starts from the same exercise data:
//   npx prisma db seed
// Safe to re-run: exercises use dataset IDs and existing local accounts are preserved.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Level } from "../src/generated/prisma/client";
import {
  EXERCISE_CUE_IDS,
  getExerciseCueFields,
  getMissingExerciseCueIds,
} from "./exerciseCueData";
import {
  exercisesWithoutGuidance,
  guidanceForExercise,
} from "./exerciseGuidanceData";
import { displayNameFor } from "../src/lib/exercises/displayNames";
import { seedLocalDemoUsers } from "./demo-users";

const EXERCISES_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json";

// The shape of one record in the dataset; only the fields we store.
type SourceExercise = {
  id: string;
  name: string;
  level: "beginner" | "intermediate" | "expert";
  equipment: string | null;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
};

const LEVELS: Record<SourceExercise["level"], Level> = {
  beginner: Level.BEGINNER,
  intermediate: Level.INTERMEDIATE,
  expert: Level.EXPERT,
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedExercises() {
  const response = await fetch(EXERCISES_URL);
  if (!response.ok) {
    throw new Error(`Could not download exercises: ${response.status}`);
  }
  const exercises = (await response.json()) as SourceExercise[];
  const missingCueIds = getMissingExerciseCueIds(
    EXERCISE_CUE_IDS,
    exercises.map((e) => e.id),
  );
  if (missingCueIds.length > 0) {
    throw new Error(
      `Curated exercise cues are missing from the source library: ${missingCueIds.join(", ")}`,
    );
  }
  const withoutGuidance = exercisesWithoutGuidance(exercises);
  if (withoutGuidance.length > 0) {
    throw new Error(
      `No form guidance for: ${withoutGuidance.join(", ")}. Add cues to prisma/data/exercise-guidance-fallback.json.`,
    );
  }
  let cueCount = 0;

  // Batches keep the number of round trips down; 876 single upserts would be slow.
  const batchSize = 50;
  for (let i = 0; i < exercises.length; i += batchSize) {
    const batch = exercises.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((e) => {
        if (getExerciseCueFields(e.id)) cueCount += 1;
        // Curated cues first, then the dataset's own steps (#193, D45).
        const guidance = guidanceForExercise(e.id, e.instructions);
        const name = displayNameFor(e.id, e.name);
        return prisma.exercise.upsert({
          where: { id: e.id },
          create: {
            id: e.id,
            name,
            level: LEVELS[e.level],
            equipment: e.equipment,
            category: e.category,
            primaryMuscles: e.primaryMuscles,
            secondaryMuscles: e.secondaryMuscles,
            instructions: e.instructions,
            images: e.images,
            cues: guidance.cues,
            commonMistakes: guidance.commonMistakes,
          },
          update: {
            name,
            level: LEVELS[e.level],
            equipment: e.equipment,
            category: e.category,
            primaryMuscles: e.primaryMuscles,
            secondaryMuscles: e.secondaryMuscles,
            instructions: e.instructions,
            images: e.images,
            cues: guidance.cues,
            commonMistakes: guidance.commonMistakes,
          },
        });
      }),
    );
  }
  return { exerciseCount: exercises.length, cueCount };
}

async function main() {
  const { exerciseCount, cueCount } = await seedExercises();
  if (cueCount !== EXERCISE_CUE_IDS.length) {
    throw new Error(
      `Seeded ${cueCount} exercises with cues; expected ${EXERCISE_CUE_IDS.length}.`,
    );
  }
  console.log(
    `Seeded ${exerciseCount} exercises (${cueCount} with cues and common mistakes)`,
  );
  const demoUsers = await seedLocalDemoUsers(prisma, {
    password: process.env.DEMO_PASSWORD,
    databaseURL: process.env.DATABASE_URL,
    environment: process.env.NODE_ENV,
  });
  for (const demo of demoUsers) {
    console.log(`Local demo login: ${demo.email} (${demo.tier})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
