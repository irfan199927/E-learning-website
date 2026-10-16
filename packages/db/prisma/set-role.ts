/**
 * Give an existing user a role (e.g. make yourself ADMIN or a colleague TEACHER after they sign in with Google).
 * Production: run it from GitHub → Actions → "Admin: set user role" (uses the DATABASE_DIRECT_URL secret).
 * Locally: pnpm db:set-role -- someone@example.com TEACHER
 */
import { createDb } from "../src/client";
import { Role } from "../src/generated/prisma/enums";

const [email, roleArg] = process.argv.slice(2).filter((a) => a !== "--");
const role = roleArg?.toUpperCase() as Role | undefined;
if (!email || !role || !Object.values(Role).includes(role)) {
  console.error(`Usage: set-role <email> <${Object.values(Role).join("|")}>`);
  process.exit(2);
}

const db = createDb(process.env.DATABASE_URL ?? "");
try {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    console.error(
      `No user with email ${email}. They must sign in once (with Google) before you can set a role.`,
    );
    process.exit(1);
  }
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role, isActive: true } }),
    db.auditLog.create({
      data: {
        action: "user.role",
        targetType: "User",
        targetId: user.id,
        meta: { from: user.role, to: role },
      },
    }),
  ]);
  console.log(`${user.email}: ${user.role} → ${role}`);
} finally {
  await db.$disconnect();
}
