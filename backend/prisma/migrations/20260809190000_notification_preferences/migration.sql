-- Adds per-channel, per-notification-type preference flags to User.
-- Defaults to true so existing accounts keep receiving everything they
-- already get today; nothing changes until someone opts out.
ALTER TABLE "User"
  ADD COLUMN "notifyEmailAnnouncements" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifySmsAnnouncements"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyEmailMessages"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifySmsMessages"        BOOLEAN NOT NULL DEFAULT true;
