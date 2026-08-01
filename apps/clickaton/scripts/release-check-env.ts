/**
 * ETAPA 10A — chequeo seguro de variables de entorno para release Clickatón.
 *
 * - No imprime secretos ni valores completos sensibles.
 * - Exit != 0 ante bloqueos (ausencias críticas, mezcla TEST/LIVE, URLs inválidas).
 *
 * Uso:
 *   pnpm clickaton:release:check-env
 *   pnpm --filter clickaton release:check-env
 *   CLICKATON_RELEASE_ENV=staging pnpm clickaton:release:check-env
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type Severity = "block" | "warn" | "info";
type EnvTarget = "local" | "test" | "preview" | "staging" | "production";

type Finding = {
  severity: Severity;
  code: string;
  message: string;
};

type VarSpec = {
  name: string;
  requiredFor: EnvTarget[];
  sensitive: boolean;
  format?: "url" | "https-url" | "nonempty" | "enum";
  enumValues?: string[];
  consumer: string;
};

const ROOT = resolve(process.cwd());
const CLICKATON_DIR = existsSync(resolve(ROOT, "apps/clickaton"))
  ? resolve(ROOT, "apps/clickaton")
  : ROOT;

const TARGET = (process.env.CLICKATON_RELEASE_ENV?.trim().toLowerCase() ||
  "local") as EnvTarget;

const SPECS: VarSpec[] = [
  {
    name: "DATABASE_URL",
    requiredFor: ["local", "test", "preview", "staging", "production"],
    sensitive: true,
    format: "nonempty",
    consumer: "clickaton / @repo/db",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    requiredFor: ["local", "staging", "production"],
    sensitive: false,
    format: "nonempty",
    consumer: "clickaton / @repo/auth",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    requiredFor: ["local", "staging", "production"],
    sensitive: true,
    format: "nonempty",
    consumer: "clickaton / @repo/auth",
  },
  {
    name: "CLICKATON_PUBLIC_URL",
    requiredFor: ["staging", "production"],
    sensitive: false,
    format: "https-url",
    consumer: "clickaton checkout/emails",
  },
  {
    name: "CLICKATON_PUBLIC_WEB_BASE_URL",
    requiredFor: ["local", "staging", "production"],
    sensitive: false,
    format: "url",
    consumer: "clickaton auth/public",
  },
  {
    name: "APP_URL",
    requiredFor: ["staging", "production"],
    sensitive: false,
    format: "url",
    consumer: "clickaton",
  },
  {
    name: "DNX_PAYMENTS_WEBHOOK_SECRET",
    requiredFor: ["staging", "production"],
    sensitive: true,
    format: "nonempty",
    consumer: "clickaton webhooks",
  },
  {
    name: "DNX_PAYMENTS_WEBHOOK_PUBLIC_URL",
    requiredFor: ["staging", "production"],
    sensitive: false,
    format: "https-url",
    consumer: "clickaton / mercado pago",
  },
  {
    name: "CRON_SECRET",
    requiredFor: ["staging", "production"],
    sensitive: true,
    format: "nonempty",
    consumer: "clickaton crons",
  },
  {
    name: "CLICKATON_CRON_SECRET",
    requiredFor: [],
    sensitive: true,
    format: "nonempty",
    consumer: "clickaton crons (fallback)",
  },
  {
    name: "CLICKATON_DNX_PAYMENTS_PROVIDER",
    requiredFor: ["staging"],
    sensitive: false,
    format: "enum",
    enumValues: ["manual", "mercado_pago_test"],
    consumer: "clickaton checkout",
  },
  {
    name: "MERCADOPAGO_TEST_ACCESS_TOKEN",
    requiredFor: ["staging", "test"],
    sensitive: true,
    format: "nonempty",
    consumer: "dnx payments TEST",
  },
  {
    name: "MERCADOPAGO_TEST_PUBLIC_KEY",
    requiredFor: ["staging", "test"],
    sensitive: false,
    format: "nonempty",
    consumer: "dnx payments TEST",
  },
  {
    name: "MERCADOPAGO_CREDENTIALS_SOURCE",
    requiredFor: ["staging", "test"],
    sensitive: false,
    format: "enum",
    enumValues: ["credenciales_de_prueba", "unknown", "production_panel"],
    consumer: "dnx payments attestation",
  },
  {
    name: "CLICKATON_MP_CLIENT_ID",
    requiredFor: [],
    sensitive: false,
    format: "nonempty",
    consumer: "owner/partner oauth",
  },
  {
    name: "CLICKATON_MP_CLIENT_SECRET",
    requiredFor: [],
    sensitive: true,
    format: "nonempty",
    consumer: "owner/partner oauth",
  },
  {
    name: "CLICKATON_MP_REDIRECT_URI",
    requiredFor: [],
    sensitive: false,
    format: "https-url",
    consumer: "owner/partner oauth",
  },
  {
    name: "DNX_FINANCIAL_CREDENTIAL_MASTER_KEY",
    requiredFor: [],
    sensitive: true,
    format: "nonempty",
    consumer: "payments vault",
  },
  {
    name: "DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED",
    requiredFor: [],
    sensitive: false,
    format: "nonempty",
    consumer: "mp oauth gate",
  },
  {
    name: "RESEND_API_KEY",
    requiredFor: ["production"],
    sensitive: true,
    format: "nonempty",
    consumer: "email (Resend)",
  },
  {
    name: "EMAIL_FROM",
    requiredFor: ["staging", "production"],
    sensitive: false,
    format: "nonempty",
    consumer: "email from",
  },
  {
    name: "DNX_SOCIAL_PUBLISHER_LIVE",
    requiredFor: [],
    sensitive: false,
    format: "nonempty",
    consumer: "social publisher gate (must stay false for initial release)",
  },
  {
    name: "COOKIE_DOMAIN",
    requiredFor: [],
    sensitive: false,
    format: "nonempty",
    consumer: "dnx session",
  },
  {
    name: "AUTH0_DOMAIN",
    requiredFor: [],
    sensitive: false,
    format: "nonempty",
    consumer: "N/A — Auth0 no usado",
  },
  {
    name: "AUTH0_CLIENT_ID",
    requiredFor: [],
    sensitive: false,
    format: "nonempty",
    consumer: "N/A — Auth0 no usado",
  },
];

function loadDotEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function mergeEnv(): Record<string, string> {
  const files = [
    resolve(CLICKATON_DIR, ".env.local"),
    resolve(CLICKATON_DIR, ".env"),
    resolve(ROOT, "packages/db/.env"),
    resolve(ROOT, ".env.local"),
  ];
  const merged: Record<string, string> = {};
  for (const f of files) Object.assign(merged, loadDotEnvFile(f));
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.length > 0) merged[k] = v;
  }
  return merged;
}

function isUrl(value: string, httpsOnly: boolean): boolean {
  try {
    const u = new URL(value);
    if (httpsOnly && u.protocol !== "https:") return false;
    if (!httpsOnly && u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

function looksLikeLiveMpToken(value: string): boolean {
  // Heurística segura: no imprimir el token. Prefijos conocidos.
  if (value.startsWith("APP_USR-") && process.env.MERCADOPAGO_CREDENTIALS_SOURCE !== "credenciales_de_prueba") {
    return true;
  }
  if (value.startsWith("TEST-")) return false;
  if (value.includes("TEST") || value.includes("test")) return false;
  // Si está en variable TEST_* pero no tiene prefijo TEST-, marcar sospecha.
  return !value.startsWith("TEST-") && value.length > 20;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function main(): void {
  const env = mergeEnv();
  const findings: Finding[] = [];

  console.log("=== CLICKATON RELEASE ENV CHECK (10A) ===");
  console.log(`target=${TARGET}`);
  console.log("mode=presence+format (no secret values)");
  console.log("");

  for (const spec of SPECS) {
    const raw = env[spec.name];
    const present = Boolean(raw && raw.trim());
    const required = spec.requiredFor.includes(TARGET);
    const status = present ? "present" : "absent";
    const last4 =
      present && !spec.sensitive && raw!.trim().length >= 4
        ? ` last4=…${raw!.trim().slice(-4)}`
        : "";
    console.log(
      `${spec.name}\tenv=${TARGET}\t${status}\tsensitive=${spec.sensitive}\trequired=${required}\tconsumer=${spec.consumer}${last4}`,
    );

    if (required && !present) {
      findings.push({
        severity: "block",
        code: "MISSING_REQUIRED",
        message: `${spec.name} ausente para ${TARGET}`,
      });
      continue;
    }
    if (!present) continue;

    const value = raw!.trim();
    if (spec.format === "url" && !isUrl(value, false)) {
      findings.push({
        severity: "block",
        code: "INVALID_URL",
        message: `${spec.name} no es URL http(s) válida`,
      });
    }
    if (spec.format === "https-url" && !isUrl(value, true)) {
      findings.push({
        severity: "block",
        code: "INVALID_HTTPS_URL",
        message: `${spec.name} debe ser HTTPS sin credenciales`,
      });
    }
    if (spec.format === "enum" && spec.enumValues && !spec.enumValues.includes(value)) {
      findings.push({
        severity: "block",
        code: "INVALID_ENUM",
        message: `${spec.name} valor no permitido para ${TARGET}`,
      });
    }
  }

  // Mezcla TEST/LIVE (10E.4: production provider allowed only on production target + LIVE flag)
  const provider = env.CLICKATON_DNX_PAYMENTS_PROVIDER?.trim();
  const liveFlagRaw = (env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED ?? "")
    .trim()
    .toLowerCase();
  const liveFlagOn =
    liveFlagRaw === "1" ||
    liveFlagRaw === "true" ||
    liveFlagRaw === "yes" ||
    liveFlagRaw === "on";
  if (provider === "mercado_pago_production") {
    if (TARGET !== "production") {
      findings.push({
        severity: "block",
        code: "LIVE_PROVIDER_STAGING_FORBIDDEN",
        message:
          "CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_production prohibido fuera de Production",
      });
    } else if (!liveFlagOn) {
      findings.push({
        severity: "warn",
        code: "LIVE_PROVIDER_FLAG_OFF",
        message:
          "Provider mercado_pago_production configurado pero DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=OFF (checkout LIVE fail-closed)",
      });
    } else {
      findings.push({
        severity: "warn",
        code: "LIVE_PROVIDER_ARMED",
        message:
          "LIVE payments ARMED (provider production + flag ON). Solo tras LEGAL APPROVED FOR REGISTRATION",
      });
    }
  }
  if (TARGET !== "production" && liveFlagOn) {
    findings.push({
      severity: "block",
      code: "LIVE_FLAG_ON_NON_PROD",
      message: "DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED no debe estar ON en staging/preview",
    });
  }
  if (TARGET === "production" && provider === "mercado_pago_test") {
    findings.push({
      severity: "warn",
      code: "TEST_PROVIDER_IN_PROD_PROJECT",
      message: "Provider TEST en proyecto production — verificar que no cobren LIVE",
    });
  }
  const testToken = env.MERCADOPAGO_TEST_ACCESS_TOKEN?.trim();
  if (testToken && looksLikeLiveMpToken(testToken)) {
    findings.push({
      severity: "block",
      code: "TEST_LIVE_MIX",
      message:
        "MERCADOPAGO_TEST_ACCESS_TOKEN no parece TEST (prefijo/attestation). Posible mezcla TEST/LIVE",
    });
  }
  const credSource = env.MERCADOPAGO_CREDENTIALS_SOURCE?.trim();
  if (testToken?.startsWith("APP_USR-") && credSource !== "credenciales_de_prueba") {
    findings.push({
      severity: "block",
      code: "MISSING_TEST_ATTESTATION",
      message:
        "Token APP_USR-* en variable TEST sin MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba",
    });
  }

  // Localhost en production
  for (const name of [
    "CLICKATON_PUBLIC_URL",
    "CLICKATON_PUBLIC_WEB_BASE_URL",
    "APP_URL",
    "DNX_PAYMENTS_WEBHOOK_PUBLIC_URL",
    "CLICKATON_MP_REDIRECT_URI",
  ]) {
    const value = env[name]?.trim();
    if (!value) continue;
    const host = hostOf(value);
    if (!host) continue;
    if (TARGET === "production" && (host === "localhost" || host.endsWith(".localhost"))) {
      findings.push({
        severity: "block",
        code: "LOCALHOST_IN_PRODUCTION",
        message: `${name} apunta a localhost en production`,
      });
    }
    if (TARGET === "production" && host.includes("vercel.app") && name.includes("PUBLIC")) {
      findings.push({
        severity: "warn",
        code: "VERCEL_APP_IN_PRODUCTION",
        message: `${name} usa host *.vercel.app en production (preferir maratonfotografica.com)`,
      });
    }
    if (
      TARGET === "production" &&
      host.includes("staging") &&
      (name.includes("PUBLIC") || name.includes("WEBHOOK") || name.includes("REDIRECT"))
    ) {
      findings.push({
        severity: "block",
        code: "STAGING_HOST_IN_PRODUCTION",
        message: `${name} parece staging en target production`,
      });
    }
  }

  // Auth0 no debe usarse
  if (env.AUTH0_DOMAIN || env.AUTH0_CLIENT_ID || env.AUTH0_SECRET) {
    findings.push({
      severity: "warn",
      code: "AUTH0_PRESENT_BUT_UNUSED",
      message:
        "Variables Auth0 presentes; la identidad real es DNX + Google OAuth (no Auth0)",
    });
  }

  // registration / live gates must stay off in 10A audit context
  if (env.CLICKATON_SEED_ARGENTINA_2026 === "1" && TARGET === "production") {
    findings.push({
      severity: "warn",
      code: "SEED_FLAG_IN_PRODUCTION",
      message: "CLICKATON_SEED_ARGENTINA_2026=1 no debe usarse para abrir ventas LIVE",
    });
  }

  // Resend / EMAIL_FROM
  const resend = env.RESEND_API_KEY?.trim();
  if (resend) {
    if (resend.length < 10 || /\s/.test(resend)) {
      findings.push({
        severity: "block",
        code: "INVALID_RESEND_API_KEY_FORMAT",
        message: "RESEND_API_KEY presente pero formato inválido (no se imprime valor)",
      });
    }
  } else if (TARGET === "production") {
    findings.push({
      severity: "block",
      code: "RESEND_MISSING_IN_PRODUCTION",
      message: "RESEND_API_KEY ausente en production (email habilitado requiere clave)",
    });
  }

  const emailFrom = env.EMAIL_FROM?.trim() || env.DNX_EMAIL_FROM?.trim();
  if (emailFrom) {
    const looksEmail =
      /^.+\@.+\..+$/.test(emailFrom) || /^.+<\s*[^@\s]+@[^@\s]+\.[^@\s]+\s*>$/.test(emailFrom);
    if (!looksEmail) {
      findings.push({
        severity: "block",
        code: "INVALID_EMAIL_FROM",
        message: "EMAIL_FROM / DNX_EMAIL_FROM no tiene formato válido",
      });
    }
    const lower = emailFrom.toLowerCase();
    if (
      TARGET === "production" &&
      (lower.includes("localhost") ||
        lower.includes("example.com") ||
        lower.includes("@test") ||
        lower.includes("noreply@dnxsuite.com"))
    ) {
      findings.push({
        severity: "warn",
        code: "DEV_EMAIL_FROM_IN_PRODUCTION",
        message: "EMAIL_FROM parece dirección de desarrollo/default en production",
      });
    }
  }

  // Social publisher must stay off for initial release unless explicitly true
  const socialLive = (env.DNX_SOCIAL_PUBLISHER_LIVE ?? "false").trim().toLowerCase();
  if (socialLive === "true" || socialLive === "1" || socialLive === "on") {
    findings.push({
      severity: "block",
      code: "SOCIAL_PUBLISHER_LIVE_ENABLED",
      message:
        "DNX_SOCIAL_PUBLISHER_LIVE=true bloqueado en release inicial — no publica redes automáticamente",
    });
  } else {
    findings.push({
      severity: "info",
      code: "SOCIAL_PUBLISHER_LIVE_OFF",
      message: "DNX_SOCIAL_PUBLISHER_LIVE off/false — OK para release inicial",
    });
  }

  const mpRedirect = env.CLICKATON_MP_REDIRECT_URI?.trim();
  if (mpRedirect && !mpRedirect.includes("/api/clickaton/payments/mercadopago/callback")) {
    findings.push({
      severity: "block",
      code: "INVALID_MP_CALLBACK_URL",
      message: "CLICKATON_MP_REDIRECT_URI no apunta al callback OAuth esperado",
    });
  }

  console.log("");
  console.log("=== FINDINGS ===");
  if (findings.length === 0) {
    console.log("none");
  } else {
    for (const f of findings) {
      console.log(`[${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
    }
  }

  const blocks = findings.filter((f) => f.severity === "block");
  const warns = findings.filter((f) => f.severity === "warn");
  console.log("");
  console.log(`summary blocks=${blocks.length} warns=${warns.length}`);
  if (blocks.length > 0) process.exitCode = 1;
}

main();
