/**
 * Create a password account (for servers without Google sign-in, e.g. the LAN-only UAT).
 * Prints a generated password once; the user can change it with "Forgot password".
 *   pnpm db:create-user -- teacher@example.com "Meera Kulkarni" TEACHER
 * UAT: deploy/uat/manage.sh create-user ...
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createDb } from "../src/client";
import { Role } from "../src/generated/prisma/enums";

const [rawEmail, name, roleArg = "STUDENT"] = process.argv.slice(2).filter((a) => a !== "--");
const role = roleArg.toUpperCase() as Role;
const email = rawEmail?.trim().toLowerCase();
if (!email || !email.includes("@") || !name || !Object.values(Role).includes(role)) {
  console.error(`Usage: create-user <email> "<full name>" [${Object.values(Role).join("|")}]`);
  process.exit(2);
}

const db = createDb(process.env.DATABASE_URL ?? "");
try {
  if (await db.user.findUnique({ where: { email } })) {
    console.error(`${email} already exists. Use set-role to change their role.`);
    process.exit(1);
  }
  const password = randomBytes(9).toString("base64url"); // 12 characters
  const user = await db.user.create({
    data: { email, name, role, emailVerified: true, isActive: true },
  });
  await db.account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(password),
    },
  });
  await db.auditLog.create({
    data: { action: "user.create", targetType: "User", targetId: user.id, meta: { role } },
  });
  console.log(
    `Created ${role} ${email}\nTemporary password: ${password}\n(Share it privately; they can change it with "Forgot password".)`,
  );
} finally {
  await db.$disconnect();
}
