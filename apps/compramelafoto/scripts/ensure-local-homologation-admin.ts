#!/usr/bin/env node
/**
 * LOCAL ONLY — create/update a TEST ADMIN for sandbox homologation login.
 *
 * Usage:
 *   CLF_LOCAL_ADMIN_PASSWORD='…' pnpm --filter compramelafoto admin:ensure-local-homologation-admin
 *
 * Optional:
 *   CLF_LOCAL_ADMIN_EMAIL=admin.homologation.local@test.local
 *
 * Safety:
 * - Aborts unless DATABASE_URL host is localhost/127.0.0.1
 * - Aborts if DB name looks like production
 * - Forces apps/compramelafoto/.env.local over packages/db/.env (Neon)
 * - Never prints the password or hash
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_EMAIL = "admin.homologation.local@test.local";
const TAG = "HOMOLOGATION_TEST_ONLY";

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

/**
 * Prefer apps/compramelafoto/.env.local exclusively for DB targeting.
 * `@repo/db` / Prisma may preload packages/db/.env (Neon) into process.env —
 * that must NEVER win for this local-only script.
 */
function loadClfEnv(): Record<string, string> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [
    resolve(here, "../.env.local"),
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "apps/compramelafoto/.env.local"),
    resolve(process.cwd(), "../../apps/compramelafoto/.env.local"),
  ];
  let fileEnv: Record<string, string> = {};
  let loadedFrom: string | null = null;
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    fileEnv = parseEnvFile(path);
    if (fileEnv.DATABASE_URL) {
      loadedFrom = path;
      break;
    }
  }
  if (!loadedFrom || !fileEnv.DATABASE_URL) {
    throw new Error(
      "CLF apps/compramelafoto/.env.local DATABASE_URL not found — abort",
    );
  }

  const map: Record<string, string> = {
    ...fileEnv,
    CLF_LOCAL_ADMIN_PASSWORD:
      process.env.CLF_LOCAL_ADMIN_PASSWORD?.trim() ||
      fileEnv.CLF_LOCAL_ADMIN_PASSWORD ||
      "",
    CLF_LOCAL_ADMIN_EMAIL:
      process.env.CLF_LOCAL_ADMIN_EMAIL?.trim() ||
      fileEnv.CLF_LOCAL_ADMIN_EMAIL ||
      "",
  };
  // Force Prisma to the CLF local URL before any client is constructed.
  process.env.DATABASE_URL = map.DATABASE_URL;
  if (map.DIRECT_URL) process.env.DIRECT_URL = map.DIRECT_URL;
  return map;
}

function assertLocalDatabase(databaseUrl: string): {
  host: string;
  name: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL unparseable — abort");
  }
  const host = parsed.hostname;
  const name = parsed.pathname.replace(/^\//, "");
  const localHost = host === "127.0.0.1" || host === "localhost";
  if (!localHost) {
    console.error(
      JSON.stringify({
        ok: false,
        abort: "PRODUCTION_DATABASE_SAFETY_BLOCKER",
        hostSanitized: `${parsed.protocol}//${host}`,
      }),
    );
    process.exit(99);
  }
  if (/prod|production|neon/i.test(name) && !/local/i.test(name)) {
    console.error(
      JSON.stringify({
        ok: false,
        abort: "PRODUCTION_DATABASE_SAFETY_BLOCKER",
        databaseName: name,
      }),
    );
    process.exit(99);
  }
  return { host, name };
}

async function main() {
  const env = loadClfEnv();
  const databaseUrl = env.DATABASE_URL.trim();
  const { host, name } = assertLocalDatabase(databaseUrl);

  const password = (env.CLF_LOCAL_ADMIN_PASSWORD ?? "").trim();
  if (password.length < 10) {
    console.error(
      JSON.stringify({
        ok: false,
        abort: "PASSWORD_REQUIRED",
        hint: "Set CLF_LOCAL_ADMIN_PASSWORD (≥10 chars). Never commit it.",
        hostSanitized: `postgresql://${host}:5432`,
        databaseName: name,
      }),
    );
    process.exit(3);
  }

  // Dynamic imports AFTER forcing local DATABASE_URL.
  const { PrismaClient, Role } = await import("@prisma/client");
  const { hashPassword, normalizeIdentityEmail } = await import("@repo/auth");

  const emailRaw =
    (env.CLF_LOCAL_ADMIN_EMAIL ?? DEFAULT_EMAIL).trim() || DEFAULT_EMAIL;
  const normalized = normalizeIdentityEmail(emailRaw);
  if (!normalized.ok) {
    console.error(JSON.stringify({ ok: false, abort: "INVALID_EMAIL" }));
    process.exit(4);
  }
  const email = normalized.email;
  const passwordHash = hashPassword(password);

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, tags: true, isBlocked: true },
    });

    if (existing?.isBlocked) {
      console.error(
        JSON.stringify({
          ok: false,
          abort: "USER_BLOCKED",
          userId: existing.id,
        }),
      );
      process.exit(5);
    }

    const tags = Array.from(
      new Set([...(existing?.tags ?? []), TAG, "TEST"]),
    );

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            password: passwordHash,
            role: Role.ADMIN,
            name: "CLF Homologation Admin (TEST)",
            tags,
            emailVerifiedAt: new Date(),
            isBlocked: false,
          },
          select: { id: true, email: true, role: true },
        })
      : await prisma.user.create({
          data: {
            email,
            password: passwordHash,
            role: Role.ADMIN,
            name: "CLF Homologation Admin (TEST)",
            tags,
            emailVerifiedAt: new Date(),
          },
          select: { id: true, email: true, role: true },
        });

    console.log(
      JSON.stringify(
        {
          ok: true,
          action: existing ? "UPDATED" : "CREATED",
          environment: "LOCAL",
          hostSanitized: `postgresql://${host}:5432`,
          databaseName: name,
          userId: user.id,
          email: user.email,
          role: user.role,
          passwordConfigured: true,
          note: "TEST / HOMOLOGATION ONLY — not for production",
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      fatal: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    }),
  );
  process.exit(1);
});
