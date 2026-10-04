-- CreateEnum
CREATE TYPE "membership_status" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "activeHouseId" UUID,
    "demoNextNudgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "nameKey" TEXT NOT NULL,
    "code" CHAR(6) NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "houseId" UUID NOT NULL,
    "status" "membership_status" NOT NULL DEFAULT 'pending',
    "colorIndex" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),
    "setupDoneAt" TIMESTAMPTZ(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiet_times" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "houseId" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "startMinute" SMALLINT NOT NULL,
    "endMinute" SMALLINT NOT NULL,

    CONSTRAINT "quiet_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nudges" (
    "id" UUID NOT NULL,
    "houseId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "messageIndex" SMALLINT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),

    CONSTRAINT "nudges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heads_ups" (
    "id" UUID NOT NULL,
    "houseId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "text" VARCHAR(200) NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "heads_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_state" (
    "key" TEXT NOT NULL,
    "value" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_state_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_activeHouseId_idx" ON "users"("activeHouseId");

-- CreateIndex
CREATE UNIQUE INDEX "houses_inviteToken_key" ON "houses"("inviteToken");

-- CreateIndex
CREATE INDEX "houses_ownerId_idx" ON "houses"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "houses_nameKey_code_key" ON "houses"("nameKey", "code");

-- CreateIndex
CREATE INDEX "memberships_houseId_status_idx" ON "memberships"("houseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_houseId_key" ON "memberships"("userId", "houseId");

-- CreateIndex
CREATE INDEX "quiet_times_houseId_idx" ON "quiet_times"("houseId");

-- CreateIndex
CREATE INDEX "quiet_times_userId_houseId_idx" ON "quiet_times"("userId", "houseId");

-- CreateIndex
CREATE INDEX "quiet_times_setId_idx" ON "quiet_times"("setId");

-- CreateIndex
CREATE INDEX "nudges_senderId_createdAt_idx" ON "nudges"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "nudges_recipientId_acknowledgedAt_idx" ON "nudges"("recipientId", "acknowledgedAt");

-- CreateIndex
CREATE INDEX "nudges_houseId_createdAt_idx" ON "nudges"("houseId", "createdAt");

-- CreateIndex
CREATE INDEX "heads_ups_houseId_at_idx" ON "heads_ups"("houseId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_activeHouseId_fkey" FOREIGN KEY ("activeHouseId") REFERENCES "houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houses" ADD CONSTRAINT "houses_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiet_times" ADD CONSTRAINT "quiet_times_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiet_times" ADD CONSTRAINT "quiet_times_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nudges" ADD CONSTRAINT "nudges_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heads_ups" ADD CONSTRAINT "heads_ups_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heads_ups" ADD CONSTRAINT "heads_ups_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

