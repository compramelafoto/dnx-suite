#!/usr/bin/env node
/**
 * LOCAL ONLY — crea/actualiza fotógrafos A/B para E2E Template V2.
 *
 * Usage:
 *   CLF_E2E_PHOTOGRAPHER_PASSWORD='…' pnpm --filter compramelafoto e2e:ensure-template-v2-photographers
 *
 * Optional:
 *   CLF_E2E_PHOTOGRAPHER_A_EMAIL=e2e.template.v2.a@test.local
 *   CLF_E2E_PHOTOGRAPHER_B_EMAIL=e2e.template.v2.b@test.local
 *
 * Safety: aborta si DATABASE_URL no es localhost.
 * No imprime el password.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TAG = "E2E_TEMPLATE_V2_TEST_ONLY";
const DEFAULT_A = "e2e.template.v2.a@test.local";
const DEFAULT_B = "e2e.template.v2.b@test.local";

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadClfEnv(): Record<string, string> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [
    resolve(here, "../.env.local"),
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "apps/compramelafoto/.env.local"),
  ];
  let fileEnv: Record<string, string> = {};
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    fileEnv = parseEnvFile(path);
    if (fileEnv.DATABASE_URL) break;
  }
  if (!fileEnv.DATABASE_URL) {
    throw new Error("CLF .env.local DATABASE_URL not found — abort");
  }
  process.env.DATABASE_URL = fileEnv.DATABASE_URL;
  if (fileEnv.DIRECT_URL) process.env.DIRECT_URL = fileEnv.DIRECT_URL;
  return {
    ...fileEnv,
    CLF_E2E_PHOTOGRAPHER_PASSWORD:
      process.env.CLF_E2E_PHOTOGRAPHER_PASSWORD?.trim() ||
      fileEnv.CLF_E2E_PHOTOGRAPHER_PASSWORD ||
      "",
    CLF_E2E_PHOTOGRAPHER_A_EMAIL:
      process.env.CLF_E2E_PHOTOGRAPHER_A_EMAIL?.trim() ||
      fileEnv.CLF_E2E_PHOTOGRAPHER_A_EMAIL ||
      DEFAULT_A,
    CLF_E2E_PHOTOGRAPHER_B_EMAIL:
      process.env.CLF_E2E_PHOTOGRAPHER_B_EMAIL?.trim() ||
      fileEnv.CLF_E2E_PHOTOGRAPHER_B_EMAIL ||
      DEFAULT_B,
  };
}

function assertLocalDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname;
  const name = parsed.pathname.replace(/^\//, "");
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error(JSON.stringify({ ok: false, abort: "PRODUCTION_DATABASE_SAFETY_BLOCKER", host }));
    process.exit(99);
  }
  if (/prod|production|neon/i.test(name) && !/local/i.test(name)) {
    console.error(JSON.stringify({ ok: false, abort: "PRODUCTION_DATABASE_SAFETY_BLOCKER", name }));
    process.exit(99);
  }
}

async function upsertPhotographer(
  prisma: any,
  Role: any,
  hashPassword: (p: string) => string,
  normalizeIdentityEmail: (e: string) => { ok: boolean; email?: string },
  emailRaw: string,
  password: string,
  label: string
) {
  const normalized = normalizeIdentityEmail(emailRaw);
  if (!normalized.ok || !normalized.email) throw new Error(`INVALID_EMAIL_${label}`);
  const email = normalized.email;
  const passwordHash = hashPassword(password);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, tags: true, isBlocked: true },
  });
  if (existing?.isBlocked) throw new Error(`USER_BLOCKED_${label}`);
  const tags = Array.from(new Set([...(existing?.tags ?? []), TAG, "TEST", "E2E"]));
  const data = {
    password: passwordHash,
    role: Role.PHOTOGRAPHER,
    name: `E2E Template V2 Photographer ${label}`,
    tags,
    emailVerifiedAt: new Date(),
    isBlocked: false,
  };
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data, select: { id: true, email: true } })
    : await prisma.user.create({ data: { email, ...data }, select: { id: true, email: true } });
  return user;
}

async function main() {
  const env = loadClfEnv();
  assertLocalDatabase(env.DATABASE_URL.trim());
  const password = env.CLF_E2E_PHOTOGRAPHER_PASSWORD;
  if (password.length < 10) {
    console.error(
      JSON.stringify({
        ok: false,
        abort: "PASSWORD_REQUIRED",
        hint: "Set CLF_E2E_PHOTOGRAPHER_PASSWORD (≥10 chars). Never commit it.",
      })
    );
    process.exit(3);
  }

  const { PrismaClient, Role } = await import("@prisma/client");
  const { hashPassword, normalizeIdentityEmail } = await import("@repo/auth");
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL.trim() } } });

  try {
    const a = await upsertPhotographer(
      prisma,
      Role,
      hashPassword,
      normalizeIdentityEmail,
      env.CLF_E2E_PHOTOGRAPHER_A_EMAIL,
      password,
      "A"
    );
    const b = await upsertPhotographer(
      prisma,
      Role,
      hashPassword,
      normalizeIdentityEmail,
      env.CLF_E2E_PHOTOGRAPHER_B_EMAIL,
      password,
      "B"
    );

    const outPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../.env.e2e.local");
    const lines = [
      "# Generated by e2e-ensure-template-v2-photographers — DO NOT COMMIT",
      `CLF_E2E_PHOTOGRAPHER_A_EMAIL=${a.email}`,
      `CLF_E2E_PHOTOGRAPHER_A_PASSWORD=${password}`,
      `CLF_E2E_PHOTOGRAPHER_B_EMAIL=${b.email}`,
      `CLF_E2E_PHOTOGRAPHER_B_PASSWORD=${password}`,
      "",
    ];
    writeFileSync(outPath, lines.join("\n"), { mode: 0o600 });

    console.log(
      JSON.stringify({
        ok: true,
        photographerAId: a.id,
        photographerBId: b.id,
        emailA: a.email,
        emailB: b.email,
        envFile: ".env.e2e.local",
        hint: "Export vars before Playwright or source .env.e2e.local",
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
