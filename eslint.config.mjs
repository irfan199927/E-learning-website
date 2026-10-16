// Flat ESLint config for the whole monorepo.
// Rule of thumb: errors for correctness/security, no stylistic rules (Prettier owns formatting).
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "apps/web/out/**",
      "**/dist/**",
      "**/coverage/**",
      "**/generated/**",
      "**/playwright-report/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
  // Architectural boundaries: shared packages must never import from apps.
  {
    files: ["packages/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@elearner/web*", "@elearner/worker*", "next", "next/*", "react"],
              message: "packages/* must stay framework-agnostic.",
            },
          ],
        },
      ],
    },
  },
  // Route handlers must go through the services layer, not Prisma directly.
  {
    files: ["apps/web/src/app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@elearner/db",
              message: "Call a service in src/server/services instead of Prisma from a route.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    settings: { next: { rootDir: "apps/web" } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/e2e/**",
      "**/seed.ts",
      "**/set-role.ts",
      "**/create-user.ts",
      "**/scripts/**",
    ],
    rules: { "no-console": "off", "@typescript-eslint/no-explicit-any": "off" },
  },
);
