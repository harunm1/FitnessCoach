// Seeds the exercise library from free-exercise-db (public domain, docs/RESEARCH.md)
// and one demo user, so everyone on the team starts from the same data:
//   npx prisma db seed
// Safe to re-run: every write is an upsert keyed on the dataset's own ids.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Level, Tier } from "../src/generated/prisma/client";

const EXERCISES_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

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

  // Batches keep the number of round trips down; 876 single upserts would be slow.
  const batchSize = 50;
  for (let i = 0; i < exercises.length; i += batchSize) {
    const batch = exercises.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((e) =>
        prisma.exercise.upsert({
          where: { id: e.id },
          create: {
            id: e.id,
            name: e.name,
            level: LEVELS[e.level],
            equipment: e.equipment,
            category: e.category,
            primaryMuscles: e.primaryMuscles,
            secondaryMuscles: e.secondaryMuscles,
            instructions: e.instructions,
            images: e.images,
          },
          update: {
            name: e.name,
            level: LEVELS[e.level],
            equipment: e.equipment,
            category: e.category,
            primaryMuscles: e.primaryMuscles,
            secondaryMuscles: e.secondaryMuscles,
            instructions: e.instructions,
            images: e.images,
          },
        }),
      ),
    );
  }
  return exercises.length;
}

async function seedDemoUser() {
  return prisma.user.upsert({
    where: { email: "demo@fitnesscoach.local" },
    create: {
      email: "demo@fitnesscoach.local",
      name: "Demo User",
      tier: Tier.TRIAL,
      profile: {
        create: {
          goal: "MUSCLE",
          level: Level.BEGINNER,
          daysPerWeek: 3,
          equipment: ["barbell", "dumbbell", "body only"],
        },
      },
    },
    update: {},
  });
}

async function main() {
  const count = await seedExercises();
  const user = await seedDemoUser();
  console.log(`Seeded ${count} exercises and demo user ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
