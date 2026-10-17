import { emailDigestSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { setEmailDigest } from "@/server/services/account";

/** PUT /api/v1/me/email-digest — { enabled }: the daily email of unread notifications, on or off. */
export const PUT = route(async ({ req, deps, actor }) =>
  setEmailDigest(deps, actor, await body(req, emailDigestSchema)),
);
