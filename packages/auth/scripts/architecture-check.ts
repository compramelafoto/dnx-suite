/**
 * CI gate — Ley de Identidad Única DNX (ETAPA 10B.4).
 *
 * Falla si detecta implementaciones locales de autenticación no autorizadas.
 *
 * Uso: pnpm auth:architecture:check
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
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

/** Paths relativos (desde repo root) con excepciones documentadas. */
const ALLOW_USER_CREATE = [
  // Seeds / scripts / selfchecks / e2e / qa
  /\/scripts\//,
  /\/e2e\//,
  /\.selfcheck\.ts$/,
  /\.smoke\.ts$/,
  /\/qa-/,
  /seed/i,
  // Paquete autorizado
  /^packages\/auth\//,
  // Bootstrap / admin temporales — warn only si se listan abajo
];

const ALLOW_USER_CREATE_WARN_ONLY = [
  // Role-specific CLF registers aún no migrados a registerDnxAccount
  /apps\/compramelafoto\/app\/api\/auth\/register-photographer/,
  /apps\/compramelafoto\/app\/api\/auth\/register-organizer/,
  /apps\/compramelafoto\/app\/api\/auth\/register-lab/,
  /apps\/compramelafoto\/app\/api\/auth\/google\/callback/,
  /apps\/compramelafoto\/app\/api\/admin\/users/,
  /apps\/compramelafoto\/app\/api\/school-organizer\//,
  /apps\/fotoffice\/app\/api\/auth\/google\/callback/,
  /apps\/fotoffice\/app\/actions\/super-admin/,
  /apps\/infospot\/app\/api\/auth\/google\/callback/,
  /packages\/payments\//,
];

/** Cookies de autenticación / sesión de identidad permitidas. */
const ALLOWED_AUTH_SESSION_COOKIES = new Set([
  "dnx_session",
  "dnx_google_oauth",
  "dnx_judge_session", // FotoRank jurados — identidad paralela documentada (deuda)
  "auth-token", // CLF legacy bridge — deuda documentada
  "dnx_auth", // legacy FotoRank — solo cleanup al logout
  "dnx_judge_auth", // legacy jurado — solo cleanup
  "fotoffice_workspace_id",
  "fotorank_workspace_id",
  "fotorank_active_org_id",
  "compramelafoto_workspace_id",
]);

/** Nombres que parecen cookies de sesión de auth (no analytics/referral). */
const AUTH_COOKIE_NAME_RE =
  /^(dnx_|.*_)?(session|auth|token|jwt|sid)(_|$)|^(auth-token|session)$/i;

const FORBIDDEN_USER_MODELS = [
  "ClickatonUser",
  "FotorankUser",
  "InfoSpotUser",
  "FotofficeUser",
  "ComprameLaFotoUser",
  "DnxLocalUser",
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".next" ||
      name === "dist" ||
      name === "coverage" ||
      name === "_archive"
    ) {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|prisma)$/.test(name)) out.push(full);
  }
  return out;
}

function rel(file: string): string {
  return relative(ROOT, file).replace(/\\/g, "/");
}

function isAllowedUserCreate(fileRel: string): "allow" | "warn" | "error" {
  if (ALLOW_USER_CREATE.some((re) => re.test(fileRel))) return "allow";
  if (ALLOW_USER_CREATE_WARN_ONLY.some((re) => re.test(fileRel))) return "warn";
  return "error";
}

function checkPasswordLocalImpl(file: string, content: string) {
  const fileRel = rel(file);
  if (fileRel.startsWith("packages/auth/")) return;
  if (/password\.ts$/.test(fileRel) && /from ["']@repo\/auth["']/.test(content)) {
    return; // re-export OK
  }

  // Implementación local de scrypt/bcrypt para login (no FTP ni camera)
  const isAuthPath =
    /\/(auth|login|security)\//.test(fileRel) ||
    /password\.ts$/.test(fileRel) ||
    /login\/.*actions\.ts$/.test(fileRel);

  if (!isAuthPath) return;
  if (/camera-connection|ftp|FTP_BCRYPT/.test(content)) return;

  const implementsHash =
    /scryptSync\s*\(/.test(content) && /function\s+hashPassword/.test(content);
  const implementsBcryptLogin =
    /bcrypt\.(compare|hash)\s*\(/.test(content) ||
    /compareSync\s*\(/.test(content);

  if (implementsHash || (implementsBcryptLogin && /password/.test(content))) {
    // FotoRank/FotoOffice aún tienen copia local — error si no reexportan
    if (!/export\s*\{[^}]*hashPassword[^}]*\}\s*from\s*["']@repo\/auth["']/.test(content)) {
      findings.push({
        severity: "error",
        rule: "no-local-password-impl",
        file: fileRel,
        detail:
          "Implementación local de hash/verify de password. Usar @repo/auth (hashPassword / verifyPassword / verifyUserPassword).",
      });
    }
  }
}

function checkUserCreate(file: string, content: string) {
  const fileRel = rel(file);
  if (!/prisma\.user\.create\s*\(/.test(content)) return;
  const mode = isAllowedUserCreate(fileRel);
  if (mode === "allow") return;
  findings.push({
    severity: mode === "warn" ? "warn" : "error",
    rule: "no-direct-user-create",
    file: fileRel,
    detail:
      mode === "warn"
        ? "prisma.user.create fuera de packages/auth — migrar a resolveOrCreateUser (deuda permitida temporalmente)."
        : "prisma.user.create no autorizado. Usar resolveOrCreateUser de @repo/auth.",
  });
}

function checkForbiddenModels(file: string, content: string) {
  const fileRel = rel(file);
  if (!fileRel.endsWith("schema.prisma") && !fileRel.includes("prisma/")) return;
  for (const model of FORBIDDEN_USER_MODELS) {
    if (new RegExp(`model\\s+${model}\\b`).test(content)) {
      findings.push({
        severity: "error",
        rule: "no-duplicate-user-model",
        file: fileRel,
        detail: `Modelo ${model} duplica identidad central. Usar User + perfiles por app.`,
      });
    }
  }
}

function checkUnauthorizedCookies(file: string, content: string) {
  const fileRel = rel(file);
  if (fileRel.startsWith("packages/auth/")) return;
  // Solo archivos de auth/login/session — no analytics ni referral
  const isAuthSurface =
    /\/(auth|login|session|security)\//.test(fileRel) ||
    /(?:^|\/)(auth|judge-auth|session-cookie)\.ts$/.test(fileRel) ||
    /middleware\.ts$/.test(fileRel);
  if (!isAuthSurface) return;

  const cookieConst =
    /(?:SESSION_COOKIE|AUTH_COOKIE|COOKIE_NAME|ADMIN_SESSION_COOKIE|JUDGE_SESSION_COOKIE)\s*=\s*["']([a-zA-Z0-9_-]+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = cookieConst.exec(content)) !== null) {
    const name = m[1];
    if (ALLOWED_AUTH_SESSION_COOKIES.has(name)) continue;
    // Ignorar cookies claramente no-auth (referral, attribution, visitor ids)
    if (!AUTH_COOKIE_NAME_RE.test(name) && !/session|auth|token/i.test(name)) {
      continue;
    }
    findings.push({
      severity: "error",
      rule: "no-unauthorized-session-cookie",
      file: fileRel,
      detail: `Cookie de sesión de auth no autorizada: "${name}". Usar dnx_session vía @repo/auth.`,
    });
  }
}

function checkHashExposure(file: string, content: string) {
  const fileRel = rel(file);
  if (fileRel.startsWith("packages/auth/")) return;
  if (!/apps\//.test(fileRel)) return;
  // Respuestas JSON que incluyen password hash
  if (
    /NextResponse\.json\s*\(/.test(content) &&
    /password:\s*user\.password/.test(content)
  ) {
    findings.push({
      severity: "error",
      rule: "no-password-hash-exposure",
      file: fileRel,
      detail: "Posible exposición de hash de password en respuesta JSON.",
    });
  }
}

function checkEmailWithoutNormalize(file: string, content: string) {
  const fileRel = rel(file);
  if (!/\/(auth|login)\//.test(fileRel)) return;
  if (fileRel.startsWith("packages/auth/")) return;
  // findUnique by email without prior normalize hints
  if (
    /findUnique\s*\(\s*\{\s*where:\s*\{\s*email\s*:/.test(content) &&
    !/normalizeIdentityEmail|normalizeEmail|toLowerCase\(\)/.test(content)
  ) {
    findings.push({
      severity: "warn",
      rule: "email-normalize-required",
      file: fileRel,
      detail:
        "Lookup por email sin normalización visible. Usar normalizeIdentityEmail de @repo/auth.",
    });
  }
}

function checkLocalResetOrRegister(file: string, content: string) {
  const fileRel = rel(file);
  if (fileRel.startsWith("packages/auth/")) return;
  if (!/apps\//.test(fileRel)) return;

  const isResetSurface =
    /forgot-password|reset-password|password-reset|recuperar/.test(fileRel);
  if (isResetSurface) {
    const usesCentral =
      /requestPasswordReset|resetPasswordWithToken|registerDnxAccount/.test(
        content,
      ) || /from ["']@repo\/auth["']/.test(content);
    const inventsToken =
      /passwordResetToken\.create|passwordResetToken:\s*resetToken|randomBytes\(32\)/.test(
        content,
      );
    if (inventsToken && !usesCentral) {
      findings.push({
        severity: "error",
        rule: "no-local-password-reset",
        file: fileRel,
        detail:
          "Reset/forgot local detectado. Usar requestPasswordReset / resetPasswordWithToken de @repo/auth.",
      });
    }
  }

  const isRegisterSurface =
    /\/(crear-cuenta|registro|register)\//.test(fileRel) ||
    /register\/route\.ts$/.test(fileRel);
  if (isRegisterSurface && /prisma\.user\.create\s*\(/.test(content)) {
    if (!/registerDnxAccount|resolveOrCreateUser/.test(content)) {
      // Role-specific CLF registers: warn already via user-create; escalate plain register
      if (/register\/route\.ts$/.test(fileRel) || /crear-cuenta/.test(fileRel)) {
        findings.push({
          severity: "error",
          rule: "no-local-register",
          file: fileRel,
          detail:
            "Registro de identidad debe usar registerDnxAccount / resolveOrCreateUser.",
        });
      }
    }
  }
}

function main() {
  const files: string[] = [];
  for (const app of APP_DIRS) {
    walk(join(ROOT, app), files);
  }
  walk(join(ROOT, "packages/db/prisma"), files);
  walk(join(ROOT, "packages/auth"), files);

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    checkPasswordLocalImpl(file, content);
    checkUserCreate(file, content);
    checkForbiddenModels(file, content);
    checkUnauthorizedCookies(file, content);
    checkHashExposure(file, content);
    checkEmailWithoutNormalize(file, content);
    checkLocalResetOrRegister(file, content);
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  console.log("=== DNX auth:architecture:check ===");
  console.log(`files_scanned=${files.length}`);
  console.log(`errors=${errors.length} warnings=${warns.length}`);

  for (const f of findings) {
    console.log(`[${f.severity}] ${f.rule} @ ${f.file}`);
    console.log(`  ${f.detail}`);
  }

  if (errors.length > 0) {
    console.error("\nFAIL — Ley de identidad: correcciones requeridas.");
    process.exit(1);
  }

  console.log("\nPASS — sin errores bloqueantes (revisar warnings de migración).");
  process.exit(0);
}

main();
