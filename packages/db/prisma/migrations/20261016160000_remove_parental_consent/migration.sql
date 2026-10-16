-- Students are all adults: the parental-consent flow (date of birth, emailed parent links) is gone.

-- DropForeignKey
ALTER TABLE "ConsentRequest" DROP CONSTRAINT "ConsentRequest_studentId_fkey";

-- AlterTable
ALTER TABLE "Consent" DROP COLUMN "parentEmail",
DROP COLUMN "parentName";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "dateOfBirth",
DROP COLUMN "isMinor";

-- DropTable
DROP TABLE "ConsentRequest";

