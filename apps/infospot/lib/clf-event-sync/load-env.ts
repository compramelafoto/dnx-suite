/**
 * Carga .env locales para CLI (CLF_READONLY + DATABASE_URL).
 * No pisa variables ya definidas en el entorno.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function applyEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function loadCliEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "../../../..");
  applyEnvFile(path.join(root, "packages/db/.env"));
  applyEnvFile(path.join(root, "apps/infospot/.env"));
  applyEnvFile(path.join(root, "apps/infospot/.env.local"));
}
