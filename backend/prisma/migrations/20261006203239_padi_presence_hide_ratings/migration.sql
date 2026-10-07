-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RadarHide" (
    "userId" TEXT NOT NULL,
    "hiddenFromId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadarHide_pkey" PRIMARY KEY ("userId","hiddenFromId")
);

-- CreateTable
CREATE TABLE "PadiRating" (
    "id" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rateeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PadiRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RadarHide_hiddenFromId_idx" ON "RadarHide"("hiddenFromId");

-- CreateIndex
CREATE INDEX "PadiRating_rateeId_idx" ON "PadiRating"("rateeId");

-- CreateIndex
CREATE UNIQUE INDEX "PadiRating_raterId_rateeId_eventId_key" ON "PadiRating"("raterId", "rateeId", "eventId");

-- AddForeignKey
ALTER TABLE "RadarHide" ADD CONSTRAINT "RadarHide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadarHide" ADD CONSTRAINT "RadarHide_hiddenFromId_fkey" FOREIGN KEY ("hiddenFromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadiRating" ADD CONSTRAINT "PadiRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadiRating" ADD CONSTRAINT "PadiRating_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PadiRating" ADD CONSTRAINT "PadiRating_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
