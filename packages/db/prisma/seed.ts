/**
 * Local/dev seed. Idempotent: safe to run repeatedly.
 * NEVER run against production (guarded below).
 *
 * Accounts created (password for all: "Password123!"):
 *   admin@school.edu · teacher@school.edu · aanya@school.edu · rohan@school.edu · kabir@school.edu (no courses)
 *   · parent@example.com
 */
import { hashPassword } from "better-auth/crypto";
import { createDb } from "../src/client";
import { Role } from "../src/generated/prisma/enums";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL ?? "");
const PASSWORD = "Password123!";

async function upsertUser(email: string, name: string, role: Role) {
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, emailVerified: true, isActive: true },
  });
  await db.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
    update: {},
    create: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(PASSWORD),
    },
  });
  return user;
}

async function main() {
  await upsertUser("admin@school.edu", "Asha Admin", Role.ADMIN);
  const teacher = await upsertUser("teacher@school.edu", "Meera Kulkarni", Role.TEACHER);
  const aanya = await upsertUser("aanya@school.edu", "Aanya Sharma", Role.STUDENT);
  const rohan = await upsertUser("rohan@school.edu", "Rohan Patil", Role.STUDENT);
  const parent = await upsertUser("parent@example.com", "Sunita Sharma", Role.PARENT);
  // Like someone who just signed up with Google: a student with no courses yet (asks to join from /courses).
  await upsertUser("kabir@school.edu", "Kabir Rao", Role.STUDENT);

  await db.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: aanya.id } },
    update: {},
    create: { parentId: parent.id, studentId: aanya.id, verifiedAt: new Date() },
  });

  const course = await db.course.upsert({
    where: { slug: "maths-9a" },
    update: {},
    create: {
      slug: "maths-9a",
      title: "Mathematics · Grade 9-A",
      grade: "9-A",
      color: "#2340D9",
      teacherId: teacher.id,
      publishedAt: new Date(),
      modules: {
        create: [
          {
            title: "Quadratics",
            position: 1,
            lessons: {
              create: [
                {
                  title: "What is a quadratic?",
                  type: "NOTE",
                  position: 1,
                  publishedAt: new Date(),
                  body:
                    "A quadratic expression has the form ax² + bx + c, where a ≠ 0.\n\n" +
                    "This week we factorise quadratics and solve equations like x² − 5x + 6 = 0.",
                },
                {
                  title: "Graphing calculator",
                  type: "LINK",
                  position: 2,
                  publishedAt: new Date(),
                  url: "https://www.desmos.com/calculator",
                  body: "Plot y = x² − 5x + 6 and find where it crosses the x-axis.",
                },
              ],
            },
          },
          { title: "Class recordings", position: 99 },
        ],
      },
    },
  });

  for (const s of [aanya, rohan]) {
    await db.enrollment.upsert({
      where: { userId_courseId: { userId: s.id, courseId: course.id } },
      update: {},
      create: { userId: s.id, courseId: course.id },
    });
  }

  console.log(`Seeded. Sign in with any seeded email and password "${PASSWORD}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
