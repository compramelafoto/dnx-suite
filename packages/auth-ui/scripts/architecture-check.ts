/**
 * CI — UX auth unificada (ETAPA 10B.7).
 *
 * Fase 1: warn en pantallas legacy; error en anti-patrones graves nuevos
 * cuando el archivo ya importa @repo/auth-ui pero viola contratos.
 *
 * Uso: pnpm auth:ui:architecture:check
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "../../..");

type Finding = {
  severity: "error" | "warn";
  rule: string;
  file: string;
  detail: string;
};

const findings: Finding[] = [];

const APP_DIRS = [
  "apps/compramelafoto",
  "apps/clickaton",
  "apps/fotorank",
  "apps/infospot",
  "apps/fotoffice",
];

const IGNORE_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  "_archive",
  ".git",
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(p);
  }
  return out;
}

function rel(file: string) {
  return relative(ROOT, file).replace(/\\/g, "/");
}

function isAuthScreenPath(file: string): boolean {
  const r = rel(file).toLowerCase();
  // Solo superficies UI — no Route Handlers ni server actions (falsos positivos).
  if (/\/api\//.test(r) || /\/actions\.tsx?$/.test(r) || /\/actions\//.test(r)) {
    return false;
  }
  return (
    /\/(login|crear-cuenta|recuperar|forgot-password|reset-password|verificar-email|verify-email|ingresar|registro)\//.test(
      r,
    ) ||
    /\/(login|crear-cuenta|recuperar|forgot-password|reset-password|verificar-email|verify-email|ingresar)-form\./.test(
      r,
    ) ||
    /loginform|registerform|forgotpasswordform|resetpasswordform|loginclient|login-form|login-view/.test(
      r,
    )
  );
}

for (const app of APP_DIRS) {
  const files = walk(join(ROOT, app));
  for (const file of files) {
    if (!isAuthScreenPath(file)) continue;
    const src = readFileSync(file, "utf8");
    const r = rel(file);

    const usesAuthUi = src.includes("@repo/auth-ui");
    const hasPasswordInput =
      /type=["']password["']/.test(src) || /type=\{[^}]*password/.test(src);
    const hasDnxPassword = src.includes("DnxPasswordField");
    const googleHref = /Continuar con Google|\/api\/auth\/google/.test(src);

    if (!usesAuthUi && (hasPasswordInput || googleHref)) {
      findings.push({
        severity: "warn",
        rule: "legacy-auth-ui",
        file: r,
        detail:
          "Pantalla auth aún no migrada a @repo/auth-ui (deuda Fase 2/3 — permitida hasta cutover + rollout).",
      });
    }

    if (usesAuthUi && hasPasswordInput && !hasDnxPassword) {
      findings.push({
        severity: "error",
        rule: "password-without-dnx-field",
        file: r,
        detail: "Archivo usa @repo/auth-ui pero define password nativo sin DnxPasswordField.",
      });
    }

    // Anti-patrón: mensaje inseguro de enumeración en forgot
    if (/no existe (una )?cuenta|email no registrado|usuario no encontrado/i.test(src)) {
      findings.push({
        severity: "error",
        rule: "insecure-forgot-enumeration",
        file: r,
        detail: "Posible enumeración de cuentas en copy de forgot/reset.",
      });
    }

    // Anti-patrón: segundo sistema de login local obvio
    if (/createLocalUser|LocalAuthProvider|customJwtLogin/i.test(src)) {
      findings.push({
        severity: "error",
        rule: "parallel-auth-system",
        file: r,
        detail: "Señal de sistema de login paralelo no autorizado.",
      });
    }
  }
}

// Paquete auth-ui debe existir
if (!existsSync(join(ROOT, "packages/auth-ui/src/index.ts"))) {
  findings.push({
    severity: "error",
    rule: "missing-auth-ui-package",
    file: "packages/auth-ui",
    detail: "Falta el paquete @repo/auth-ui",
  });
}

const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

console.log("=== auth:ui:architecture:check ===");
console.log(`errors=${errors.length} warnings=${warns.length}`);
for (const f of findings) {
  console.log(`[${f.severity}] ${f.rule} — ${f.file}: ${f.detail}`);
}

if (errors.length > 0) {
  process.exit(1);
}

console.log("PASS (warnings legacy permitidos en Fase 1)");
process.exit(0);
