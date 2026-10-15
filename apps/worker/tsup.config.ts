import { defineConfig } from "tsup";

// Bundle workspace packages (they ship TS source); keep npm dependencies external.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  noExternal: [/^@elearner\//],
});
