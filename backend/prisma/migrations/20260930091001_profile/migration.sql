-- CreateEnum
CREATE TYPE "DrinkPreference" AS ENUM ('ALCOHOLIC', 'NON_ALCOHOLIC', 'BOTH');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "photoPublicId" TEXT,
    "bio" VARCHAR(280),
    "drinkPreference" "DrinkPreference" NOT NULL DEFAULT 'BOTH',
    "interests" TEXT[],
    "padiPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
