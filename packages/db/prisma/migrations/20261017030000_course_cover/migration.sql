-- Optional uploaded cover image per course (null = the generated tile).
-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "coverKey" TEXT;

