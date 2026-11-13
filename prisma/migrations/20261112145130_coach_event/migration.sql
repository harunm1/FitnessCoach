-- CreateEnum
CREATE TYPE "CoachEventKind" AS ENUM ('plan', 'chat');

-- CreateEnum
CREATE TYPE "CoachEventOutcome" AS ENUM ('ok', 'retried', 'switched', 'rejected', 'error', 'rule_based');

-- CreateTable
CREATE TABLE "CoachEvent" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CoachEventKind" NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "outcome" "CoachEventOutcome" NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "guardrailVerdict" TEXT,
    "providerEvents" JSONB NOT NULL,
    "problems" JSONB,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachEvent_userId_createdAt_idx" ON "CoachEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachEvent" ADD CONSTRAINT "CoachEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
