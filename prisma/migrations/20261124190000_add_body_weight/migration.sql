-- CreateTable
CREATE TABLE "BodyWeight" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weightKg" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BodyWeight_userId_date_key" ON "BodyWeight"("userId", "date");

-- AddForeignKey
ALTER TABLE "BodyWeight" ADD CONSTRAINT "BodyWeight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECKs by hand: CHECK is not in the Prisma schema (as in 20261124180300_range_checks).
-- The same bounds as the logBodyWeight form (D24): 20 to 400 kg, note up to 300 characters.
ALTER TABLE "BodyWeight"
  ADD CONSTRAINT "BodyWeight_weightKg_check" CHECK ("weightKg" BETWEEN 20 AND 400),
  ADD CONSTRAINT "BodyWeight_note_check" CHECK (char_length("note") <= 300);
