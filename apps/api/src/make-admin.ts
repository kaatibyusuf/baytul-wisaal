/**
 * Gives an existing account an administrator role, from the command line. This is how the first
 * administrator is created, because roles can otherwise only be changed by a super administrator.
 *
 *   pnpm db:make-admin you@example.com                  super administrator (default)
 *   pnpm db:make-admin you@example.com --role=ADMIN     administrator
 *   pnpm db:make-admin you@example.com --role=USER      back to an ordinary member
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  const roleArg = args.find((a) => a.startsWith("--role="))?.split("=")[1]?.toUpperCase() ?? "SUPER_ADMIN";
  if (!email || !(roleArg in Role)) {
    console.error("Usage: pnpm db:make-admin <email> [--role=SUPER_ADMIN|ADMIN|MODERATOR|USER]");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No account has the email ${email}. Sign up first, then run this again.`);
      process.exit(1);
    }
    const role = roleArg as Role;
    if (user.role === role) {
      console.log(`${email} is already ${role}. Nothing changed.`);
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { role } });
    await prisma.auditLog.create({
      data: { actorId: "cli", action: "USER_ROLE_CHANGED", targetType: "User", targetId: user.id, reason: "Set from the command line", metadata: { from: user.role, to: role } },
    });
    console.log(`${email} is now ${role} (was ${user.role}). Sign out and in again if you were signed in.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
