-- CreateEnum
CREATE TYPE "VenueApproval" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CONFIRMED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'EVENT_INVITE';
ALTER TYPE "NotificationType" ADD VALUE 'RSVP_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'RSVP_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'RSVP_DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'VENUE_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'VENUE_REJECTED';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "venueApproval" "VenueApproval" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "venueId" TEXT,
ADD COLUMN     "venueNote" VARCHAR(500),
ADD COLUMN     "venueRequestedAt" TIMESTAMP(3),
ADD COLUMN     "venueRespondedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Rsvp" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "decisionNote" VARCHAR(150),
ADD COLUMN     "message" VARCHAR(280),
ADD COLUMN     "passCode" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "closesAt" TEXT,
ADD COLUMN     "description" VARCHAR(1000),
ADD COLUMN     "opensAt" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "VenueMenuItem" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceKobo" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VenueMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueReview" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueMenuItem_venueId_position_idx" ON "VenueMenuItem"("venueId", "position");

-- CreateIndex
CREATE INDEX "VenueReview_venueId_createdAt_idx" ON "VenueReview"("venueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VenueReview_venueId_userId_key" ON "VenueReview"("venueId", "userId");

-- CreateIndex
CREATE INDEX "EventInvite_userId_idx" ON "EventInvite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvite_eventId_userId_key" ON "EventInvite"("eventId", "userId");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Rsvp_passCode_key" ON "Rsvp"("passCode");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueMenuItem" ADD CONSTRAINT "VenueMenuItem_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReview" ADD CONSTRAINT "VenueReview_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueReview" ADD CONSTRAINT "VenueReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

