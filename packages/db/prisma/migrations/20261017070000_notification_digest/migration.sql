-- Daily email of unread notifications: on by default, people can switch it off on their Account page.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailDigest" BOOLEAN NOT NULL DEFAULT true;

