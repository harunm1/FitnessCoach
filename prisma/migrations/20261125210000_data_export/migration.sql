-- CreateEnum
CREATE TYPE "ExportKind" AS ENUM ('WORKOUT_CSV', 'COACH_CSV', 'MONTHLY_REPORT');

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ExportKind" NOT NULL,
    "r2Key" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataExport_r2Key_key" ON "DataExport"("r2Key");

-- CreateIndex
CREATE INDEX "DataExport_userId_createdAt_idx" ON "DataExport"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK by hand (not in the Prisma schema): a stored file is never empty.
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_bytes_check" CHECK ("bytes" > 0);
