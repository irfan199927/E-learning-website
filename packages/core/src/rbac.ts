/**
 * Role-based permissions. This is the single source of truth for "which role may do what".
 * Resource-level checks (is this MY course? am I enrolled?) live in the web app's
 * policies (apps/web/src/server/policies) and run AFTER `can()`.
 *
 * To add a permission: add it to `Permission`, grant it below, add a test in rbac.test.ts.
 */
import { Errors } from "./errors";

export const ROLES = ["ADMIN", "TEACHER", "STUDENT", "PARENT"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "class:read"
  | "class:schedule"
  | "class:join"
  | "attendance:read"
  | "attendance:write"
  | "video:upload"
  | "video:watch"
  | "course:manage"
  | "google:connect"
  | "user:manage"
  | "report:export";

const GRANTS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    "class:read",
    "class:schedule",
    "attendance:read",
    "attendance:write",
    "video:upload",
    "video:watch",
    "course:manage",
    "user:manage",
    "report:export",
  ]),
  TEACHER: new Set<Permission>([
    "class:read",
    "class:schedule",
    "class:join",
    "attendance:read",
    "attendance:write",
    "video:upload",
    "video:watch",
    "course:manage",
    "google:connect",
    "report:export",
  ]),
  STUDENT: new Set<Permission>(["class:read", "class:join", "video:watch"]),
  PARENT: new Set<Permission>(["class:read", "attendance:read"]),
};

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].has(permission);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw Errors.forbidden();
}
