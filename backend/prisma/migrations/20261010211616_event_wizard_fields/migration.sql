-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "emoji" TEXT,
ADD COLUMN     "hostIntro" VARCHAR(2000),
ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "minJoiners" INTEGER,
ADD COLUMN     "minPadiPoints" INTEGER,
ADD COLUMN     "startingGroupSize" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "EventMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPhoneInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPhoneInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventMedia_eventId_idx" ON "EventMedia"("eventId");

-- CreateIndex
CREATE INDEX "EventPhoneInvite_eventId_idx" ON "EventPhoneInvite"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPhoneInvite_eventId_phone_key" ON "EventPhoneInvite"("eventId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Event_inviteCode_key" ON "Event"("inviteCode");

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPhoneInvite" ADD CONSTRAINT "EventPhoneInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

