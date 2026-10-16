import { route } from "@/lib/http";
import { removeStudent } from "@/server/services/roster";

type Params = { id: string; userId: string };

/** DELETE /api/v1/courses/:id/students/:userId — remove a student from the course (teacher or admin). */
export const DELETE = route<Params>(
  async ({ deps, actor, params }) => {
    await removeStudent(deps, actor, params.id, params.userId);
    return new Response(null, { status: 204 });
  },
  { roles: ["TEACHER", "ADMIN"] },
);
