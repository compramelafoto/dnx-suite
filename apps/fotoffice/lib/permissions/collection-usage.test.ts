import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * `canManageWorkspaceCollection` decide a dónde va la plata de la institución (conectar Mercado
 * Pago, consentir el split). Eso nunca se delega a un rol (diseño de roles, §4). Todo lo demás
 * de Cuotas pregunta el nivel del módulo, para que Tesorería pueda operar sin ser admin.
 */
const PERMITIDOS = [
  "app/actions/split-consent.ts",
  "app/api/payments/mercadopago/connect/start/route.ts",
  "app/workspace/configuracion/cobros/page.tsx",
  "lib/payments/connect/authz.ts",
].sort();

describe("el permiso de cobros sólo se usa para conectar el cobro", () => {
  it("ningún otro archivo lo llama", () => {
    const salida = execSync(
      `grep -rl "canManageWorkspaceCollection(" app lib components --include=*.ts --include=*.tsx || true`,
      { cwd: appRoot, encoding: "utf8" },
    );
    const archivos = salida
      .split("\n")
      .filter(Boolean)
      .filter((f) => !f.endsWith(".test.ts"))
      .sort();
    expect(archivos).toEqual(PERMITIDOS);
  });
});
