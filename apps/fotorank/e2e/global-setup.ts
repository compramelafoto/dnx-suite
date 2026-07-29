import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Datos E2E (invitación jurado, admin, etc.) deben coincidir con el seed.
 * Sin esto, tests como judge-invite fallan con "La invitación ya fue procesada".
 *
 * En staging aislado ya seedado (P0-08b) usar FOTORANK_E2E_SKIP_DB_SEED=1
 * para no ejecutar `prisma db seed` (puede fallar por módulos ajenos).
 */
export default function globalSetup(): void {
  if (process.env.FOTORANK_E2E_SKIP_DB_SEED === "1") {
    console.log("[e2e global-setup] SKIP prisma db seed (FOTORANK_E2E_SKIP_DB_SEED=1)");
    return;
  }
  const repoRoot = path.resolve(__dirname, "../../..");
  execSync("pnpm --filter @repo/db exec prisma db seed", {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env },
  });
}
