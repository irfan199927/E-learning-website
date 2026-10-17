import { coursePriceSchema } from "@elearner/core";
import { body, route } from "@/lib/http";
import { setCoursePrice } from "@/server/services/payments";

type Params = { id: string };

/** PUT /api/v1/courses/:id/price — set the price in whole rupees ({ priceRupees }; 0 = free). Admins only. */
export const PUT = route<Params>(
  async ({ req, deps, actor, params }) =>
    setCoursePrice(deps, actor, params.id, await body(req, coursePriceSchema)),
  { roles: ["ADMIN"] },
);
