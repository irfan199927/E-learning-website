/**
 * School-wide settings (one row, id 1), set by an admin on /admin/settings. Defaults apply until then.
 */
import { assertCan, type SchoolSettingsInput } from "@elearner/core";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";

export interface SchoolSettingsView {
  /** Daily watch-time goal on students' "Today's progress" ring. */
  dailyGoalMinutes: number;
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettingsView = { dailyGoalMinutes: 30 };

export async function getSchoolSettings(deps: Deps): Promise<SchoolSettingsView> {
  const s = await deps.db.schoolSettings.findUnique({ where: { id: 1 }, select: { dailyGoalMinutes: true } });
  return s ?? DEFAULT_SCHOOL_SETTINGS;
}

export async function updateSchoolSettings(
  deps: Deps,
  actor: Actor,
  input: SchoolSettingsInput,
): Promise<SchoolSettingsView> {
  assertCan(actor.role, "user:manage");
  const data = { dailyGoalMinutes: input.dailyGoalMinutes, updatedById: actor.id };
  await deps.db.schoolSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  await audit(deps.db, actor, "school.settings", { type: "SchoolSettings", id: "1" }, { ...input });
  return getSchoolSettings(deps);
}
