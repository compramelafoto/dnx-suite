import { globalIgnores } from "eslint/config";
import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // AppleDouble metadata en volúmenes externos (macOS) — no son fuente.
  globalIgnores([
    "**/._*",
    "**/.DS_Store",
    "lib/smoke/qa-visual.ts",
    "lib/smoke/e13-staging-gate.ts",
    "lib/feed/feed.e2e.ts",
  ]),
  ...nextJsConfig,
];

