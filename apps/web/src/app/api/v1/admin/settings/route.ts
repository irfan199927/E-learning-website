import { schoolSettingsSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { getSchoolSettings, updateSchoolSettings } from "@/server/services/school-settings";

/** GET /api/v1/admin/settings — school-wide settings (admin). */
export const GET = route(async ({ deps }) => getSchoolSettings(deps), { roles: ["ADMIN"] });

/** PUT /api/v1/admin/settings — { dailyGoalMinutes } (admin). */
export const PUT = route(
  async ({ req, deps, actor }) => updateSchoolSettings(deps, actor, await body(req, schoolSettingsSchema)),
  { roles: ["ADMIN"] },
);
