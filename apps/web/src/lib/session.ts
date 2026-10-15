import "server-only";
import { ROLES, type Role } from "@elearner/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Actor } from "@/server/deps";
import { auth } from "./auth";

/** Resolve the current user from the session cookie (one DB lookup per request, memoised). */
export const getActor = cache(async (reqHeaders?: Headers): Promise<Actor | null> => {
  const session = await auth().api.getSession({ headers: reqHeaders ?? (await headers()) });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; timezone?: string; isActive?: boolean };
  if (!u.isActive || !ROLES.includes(u.role as Role)) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    timezone: u.timezone ?? "Asia/Kolkata",
  };
});

/** For server components/pages: redirect to sign-in when signed out, home when the role is wrong. */
export async function requirePageActor(roles?: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (roles && !roles.includes(actor.role)) redirect("/dashboard");
  return actor;
}
