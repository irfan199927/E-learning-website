-- Payment records are kept for the school's accounts: deleting a student (erasure) or a course now unlinks the
-- payment instead of deleting it, and the names are copied onto the row so it still reads correctly.

-- AlterTable: name copies, filled from the current links, then required
ALTER TABLE "ManualPayment" ADD COLUMN "payerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "payerEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN "courseTitle" TEXT NOT NULL DEFAULT '';

UPDATE "ManualPayment" p SET "payerName" = u."name", "payerEmail" = u."email"
FROM "User" u WHERE u."id" = p."userId";
UPDATE "ManualPayment" p SET "courseTitle" = c."title"
FROM "Course" c WHERE c."id" = p."courseId";

ALTER TABLE "ManualPayment" ALTER COLUMN "payerName" DROP DEFAULT,
ALTER COLUMN "payerEmail" DROP DEFAULT,
ALTER COLUMN "courseTitle" DROP DEFAULT;

-- AlterTable: the links become optional
ALTER TABLE "ManualPayment" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "courseId" DROP NOT NULL;

-- DropForeignKey / AddForeignKey: unlink instead of delete
ALTER TABLE "ManualPayment" DROP CONSTRAINT "ManualPayment_userId_fkey";
ALTER TABLE "ManualPayment" DROP CONSTRAINT "ManualPayment_courseId_fkey";
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
