-- Daily goal setting, gradebook weighting per course, and excusing a student from one piece of work.
-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "assignmentWeight" INTEGER;

-- CreateTable
CREATE TABLE "GradeExcusal" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "itemKind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "GradeExcusal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeExcusal_courseId_idx" ON "GradeExcusal"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeExcusal_itemKind_itemId_userId_key" ON "GradeExcusal"("itemKind", "itemId", "userId");

-- AddForeignKey
ALTER TABLE "GradeExcusal" ADD CONSTRAINT "GradeExcusal_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeExcusal" ADD CONSTRAINT "GradeExcusal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

