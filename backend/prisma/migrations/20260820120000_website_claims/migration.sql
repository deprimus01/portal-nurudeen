-- ADR-001 §5: scoped website.* permission claims for CMS SSO. An SMS
-- ADMIN does not automatically receive any website.* claim — a
-- super-admin must deliberately grant one (see WebsiteClaim comment in
-- schema.prisma). One row per (user, claim), not a JSON blob, so grant/
-- revoke is a plain insert/delete and claim checks are a plain indexed
-- lookup on every /oauth/token issuance.

-- CreateEnum
CREATE TYPE "WebsiteClaimType" AS ENUM ('website_news_write', 'website_news_publish', 'website_events_write', 'website_gallery_write', 'website_settings_write', 'website_access_manage');

-- CreateTable
CREATE TABLE "WebsiteClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claim" "WebsiteClaimType" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteClaim_userId_idx" ON "WebsiteClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteClaim_userId_claim_key" ON "WebsiteClaim"("userId", "claim");

-- AddForeignKey
ALTER TABLE "WebsiteClaim" ADD CONSTRAINT "WebsiteClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteClaim" ADD CONSTRAINT "WebsiteClaim_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
