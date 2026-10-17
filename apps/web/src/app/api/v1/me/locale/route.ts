import { localeSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { setLocale } from "@/server/services/account";

/** PUT /api/v1/me/locale — { locale: "en" | "hi" | "mr" }: remember my language for emails. */
export const PUT = route(async ({ req, deps, actor }) =>
  setLocale(deps, actor, await body(req, localeSchema)),
);
