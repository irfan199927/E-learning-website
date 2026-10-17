import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPERATIONS, openApiDocument } from "./openapi";

const apiDir = fileURLToPath(new URL("../app/api/", import.meta.url));

/** Every exported handler under app/api, as "METHOD /api/path/{param}" (Better Auth's catch-all excluded). */
function routeHandlers(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") {
        const path = `/api/${relative(apiDir, dir)}`.replace(/\[(?:\.\.\.)?(\w+)\]/g, "{$1}");
        if (path.startsWith("/api/auth")) continue;
        const source = readFileSync(full, "utf8");
        for (const m of source.matchAll(
          /export (?:const|async function|function) (GET|POST|PUT|PATCH|DELETE)\b/g,
        ))
          out.push(`${m[1]} ${path}`);
      }
    }
  };
  walk(apiDir);
  return out.sort();
}

describe("OpenAPI document", () => {
  it("describes every route handler, and nothing else", () => {
    expect(OPERATIONS.map((o) => `${o.method} ${o.path}`).sort()).toEqual(routeHandlers());
  });

  it("builds request bodies and query parameters from the zod schemas", () => {
    const doc = openApiDocument("https://school.example");
    expect(doc.servers).toEqual([{ url: "https://school.example" }]);
    const price = doc.paths["/api/v1/courses/{id}/price"]!.put as {
      parameters: { name: string; in: string }[];
      requestBody: { content: { "application/json": { schema: { properties: Record<string, unknown> } } } };
    };
    expect(price.parameters).toEqual([
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ]);
    expect(Object.keys(price.requestBody.content["application/json"].schema.properties)).toEqual([
      "priceRupees",
    ]);
    const csv = doc.paths["/api/v1/admin/payments/csv"]!.get as { parameters: { name: string }[] };
    expect(csv.parameters.map((p) => p.name)).toEqual(["from", "to", "status"]);
    expect(JSON.parse(JSON.stringify(doc)).openapi).toBe("3.0.3"); // serialisable
  });
});
