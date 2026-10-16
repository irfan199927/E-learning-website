import { route } from "@/lib/http";
import { getMyGrades } from "@/server/services/gradebook";

type Params = { id: string };

/** GET /api/v1/courses/:id/my-grades — the signed-in student's marks and total in this course. */
export const GET = route<Params>(async ({ deps, actor, params }) => getMyGrades(deps, actor, params.id), {
  roles: ["STUDENT"],
});
