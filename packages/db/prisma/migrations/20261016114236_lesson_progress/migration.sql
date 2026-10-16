-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: course pages now list Lessons instead of a course's videos. Give every uploaded video that has no
-- lesson yet a published VIDEO lesson in a "Videos" module (created at the end of the course), in upload order,
-- so nothing students could see before disappears.
INSERT INTO "Module" ("id", "courseId", "title", "position")
SELECT 'mig_' || replace(gen_random_uuid()::text, '-', ''), c."courseId", 'Videos',
       COALESCE((SELECT MAX(m."position") FROM "Module" m WHERE m."courseId" = c."courseId"), 0) + 1
FROM (
  SELECT DISTINCT v."courseId" FROM "Video" v
  WHERE v."status" IN ('UPLOADED', 'TRANSCODING', 'READY')
    AND NOT EXISTS (SELECT 1 FROM "Lesson" l WHERE l."videoId" = v."id")
    AND NOT EXISTS (SELECT 1 FROM "Module" m WHERE m."courseId" = v."courseId" AND m."title" = 'Videos')
) c;

INSERT INTO "Lesson" ("id", "moduleId", "title", "type", "position", "videoId", "publishedAt")
SELECT 'mig_' || replace(gen_random_uuid()::text, '-', ''), m."id", v."title", 'VIDEO',
       COALESCE((SELECT MAX(l."position") FROM "Lesson" l WHERE l."moduleId" = m."id"), 0)
         + ROW_NUMBER() OVER (PARTITION BY v."courseId" ORDER BY v."createdAt", v."id"),
       v."id", CURRENT_TIMESTAMP
FROM "Video" v
JOIN LATERAL (
  SELECT "id" FROM "Module" WHERE "courseId" = v."courseId" AND "title" = 'Videos' ORDER BY "position" LIMIT 1
) m ON TRUE
WHERE v."status" IN ('UPLOADED', 'TRANSCODING', 'READY')
  AND NOT EXISTS (SELECT 1 FROM "Lesson" l WHERE l."videoId" = v."id");
