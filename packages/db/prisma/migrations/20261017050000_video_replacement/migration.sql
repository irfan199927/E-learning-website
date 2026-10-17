-- A replacement upload remembers which lesson it replaces; the worker swaps it in when ready.
-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "replacesLessonId" TEXT;

