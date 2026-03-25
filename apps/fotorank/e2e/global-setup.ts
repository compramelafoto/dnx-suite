import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Datos E2E (invitación jurado, admin, etc.) deben coincidir con el seed.
 * Sin esto, tests como judge-invite fallan con "La invitación ya fue procesada".
 */
export default function globalSetup(): void {
  const repoRoot = path.resolve(__dirname, "../../..");
  execSync("pnpm --filter @repo/db exec prisma db seed", {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env },
  });
}
