-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Event_tags_idx" ON "Event" USING GIN ("tags");

