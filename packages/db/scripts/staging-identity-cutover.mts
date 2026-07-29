/**
 * ETAPA 10B.6 — Cutover Clickatón → DB identidad compartida.
 *
 * Uso:
 *   CLICKATON_SOURCE_DATABASE_URL=… DNX_IDENTITY_DATABASE_URL=… \
 *     pnpm clickaton:staging:identity-cutover
 *
 *   CLICKATON_CUTOVER_CONFIRM=STAGING_IDENTITY_CUTOVER \
 *   CLICKATON_SOURCE_DATABASE_URL=… DNX_IDENTITY_DATABASE_URL=… \
 *     pnpm clickaton:staging:identity-cutover -- --execute
 *
 * Fail-closed si faltan URLs, host origen/destino inseguros, o ediciones ≠ 6.
 */

import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

type Mode = "dry-run" | "execute";

const SOURCE_HOST_ALLOW = /ep-divine-smoke-av8hmt7s/i;
const SOURCE_DB_ALLOW = /^clickaton_staging$/i;
const DEST_HOST_DENY = /ep-dawn-dew|ep-falling-darkness|ep-silent-haze/i;
const DEST_HOST_PREFERRED = /ep-round-fog-a4xgibtv/i;

type SourceUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  googleId: string | null;
  emailVerifiedAt: Date | null;
  password: string | null;
  createdAt: Date;
  has_google: boolean;
  has_password: boolean;
  verified: boolean;
  fmt: string;
};

type MapRow = {
  sourceUserId: number;
  email: string;
  resolution:
    | "MATCH_EMAIL_VERIFIED"
    | "MATCH_EXTERNAL_IDENTITY"
    | "CREATE_CANONICAL_USER"
    | "MANUAL_REVIEW"
    | "TECHNICAL_USER"
    | "INVALID";
  canonicalUserId: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

function parseArgs(argv: string[]): { mode: Mode } {
  return { mode: argv.includes("--execute") ? "execute" : "dry-run" };
}

function sanitizeUrl(raw: string | undefined) {
  if (!raw?.trim()) {
    return { present: false, hostHint: null as string | null, db: null as string | null, hash: null as string | null };
  }
  try {
    const u = new URL(raw);
    const m = u.hostname.match(/^(ep-[a-z0-9-]+)/i);
    const hostHint = m ? `${m[1]}…` : `${u.hostname.slice(0, 24)}…`;
    const db = u.pathname.replace(/^\//, "").split("?")[0] || null;
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
    return { present: true, hostHint, db, hash };
  } catch {
    return { present: true, hostHint: "unparseable", db: null, hash: null };
  }
}

function assertSafeSource(url: string) {
  const host = new URL(url).hostname;
  const db = new URL(url).pathname.replace(/^\//, "").split("?")[0];
  if (!SOURCE_HOST_ALLOW.test(host)) {
    throw new Error(`SOURCE host no permitido. Esperado ep-divine-smoke-av8hmt7s*.`);
  }
  if (!SOURCE_DB_ALLOW.test(db)) {
    throw new Error(`SOURCE db="${db}" no es clickaton_staging.`);
  }
}

function assertSafeDest(url: string) {
  const host = new URL(url).hostname;
  if (DEST_HOST_DENY.test(host)) {
    throw new Error(`DEST host parece Production. Abortado.`);
  }
  if (!DEST_HOST_PREFERRED.test(host)) {
    console.warn(
      `[warn] DEST no es ep-round-fog preferido (${host.slice(0, 28)}…). Solo continuar si es la DB identidad Staging acordada.`,
    );
  }
}

async function countSafe(prisma: PrismaClient, sql: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(sql);
    return Number(rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

async function main() {
  const { mode } = parseArgs(process.argv.slice(2));
  const sourceUrl = process.env.CLICKATON_SOURCE_DATABASE_URL?.trim();
  // No caer a DATABASE_URL local (suele ser Production dawn-dew).
  const destUrl = process.env.DNX_IDENTITY_DATABASE_URL?.trim();
  const confirm = process.env.CLICKATON_CUTOVER_CONFIRM?.trim();

  console.log("=== clickaton:staging:identity-cutover ===");
  console.log(`mode=${mode}`);
  console.log("source", sanitizeUrl(sourceUrl));
  console.log("dest  ", sanitizeUrl(destUrl));

  if (!sourceUrl || !destUrl) {
    console.error(`
BLOCKED — faltan connection strings operativas.

Requisitos:
  CLICKATON_SOURCE_DATABASE_URL  → Neon clickaton_staging (ep-divine-smoke…)
  DNX_IDENTITY_DATABASE_URL      → DB identidad Staging (preferido ep-round-fog…)

Bloqueo conocido: en Vercel proyecto clickaton-staging, DATABASE_URL es
Encrypted y \`vercel env pull\` devuelve vacío. Recuperar URL desde Neon
Console o re-cargar la variable de forma pullable.

También: FotoRank Preview hoy apunta a ep-empty-moon (≠ CLF Preview
ep-round-fog). Alinear Preview antes de fixtures cross-app.

Ver docs/clickaton/STAGING_SHARED_IDENTITY_CUTOVER_REPORT.md
`);
    process.exit(2);
  }

  assertSafeSource(sourceUrl);
  assertSafeDest(destUrl);

  if (mode === "execute" && confirm !== "STAGING_IDENTITY_CUTOVER") {
    throw new Error(
      "Execute requiere CLICKATON_CUTOVER_CONFIRM=STAGING_IDENTITY_CUTOVER",
    );
  }

  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const dest = new PrismaClient({ datasources: { db: { url: destUrl } } });

  try {
    const sourceEditions = await countSafe(
      source,
      `SELECT count(*)::int AS c FROM "ClickatonEdition"`,
    );
    const destEditions = await countSafe(
      dest,
      `SELECT count(*)::int AS c FROM "ClickatonEdition"`,
    );
    const sourceUsers = await countSafe(source, `SELECT count(*)::int AS c FROM "User"`);
    const destUsers = await countSafe(dest, `SELECT count(*)::int AS c FROM "User"`);
    const mapTable = await countSafe(
      dest,
      `SELECT count(*)::int AS c FROM information_schema.tables
       WHERE table_schema='public' AND table_name='ClickatonLegacyUserMap'`,
    );

    console.log("counts", {
      sourceEditions,
      destEditions,
      sourceUsers,
      destUsers,
      destHasLegacyMapTable: mapTable === 1,
    });

    if (
      sourceEditions !== 6 &&
      process.env.CLICKATON_CUTOVER_ALLOW_EDITION_MISMATCH !== "1"
    ) {
      throw new Error(
        `Origen tiene ${sourceEditions} ediciones; se esperan 6. Override: CLICKATON_CUTOVER_ALLOW_EDITION_MISMATCH=1`,
      );
    }

    const sourceUserRows = await source.$queryRawUnsafe<SourceUser[]>(`
      SELECT
        id,
        lower(trim(email)) AS email,
        name,
        role::text AS role,
        "googleId",
        "emailVerifiedAt",
        password,
        "createdAt",
        ("googleId" IS NOT NULL) AS has_google,
        (password IS NOT NULL) AS has_password,
        ("emailVerifiedAt" IS NOT NULL) AS verified,
        CASE
          WHEN password IS NULL THEN 'none'
          WHEN password LIKE '$2%' THEN 'bcrypt'
          WHEN password LIKE '%:%' THEN 'scrypt'
          ELSE 'unknown'
        END AS fmt
      FROM "User"
      ORDER BY id
    `);

    console.log(`source_users=${sourceUserRows.length}`);

    const mapPreview: MapRow[] = [];
    for (const row of sourceUserRows) {
      if (!row.email.includes("@")) {
        mapPreview.push({
          sourceUserId: row.id,
          email: row.email,
          resolution: "INVALID",
          canonicalUserId: null,
          confidence: "LOW",
        });
        continue;
      }

      const byEmail = await dest.$queryRawUnsafe<Array<{ id: number; googleId: string | null }>>(
        `SELECT id, "googleId" FROM "User" WHERE lower(trim(email)) = $1 LIMIT 1`,
        row.email,
      );

      if (byEmail[0]) {
        if (
          row.googleId &&
          byEmail[0].googleId &&
          byEmail[0].googleId !== row.googleId
        ) {
          mapPreview.push({
            sourceUserId: row.id,
            email: row.email,
            resolution: "MANUAL_REVIEW",
            canonicalUserId: byEmail[0].id,
            confidence: "LOW",
          });
        } else {
          mapPreview.push({
            sourceUserId: row.id,
            email: row.email,
            resolution: row.googleId
              ? "MATCH_EXTERNAL_IDENTITY"
              : "MATCH_EMAIL_VERIFIED",
            canonicalUserId: byEmail[0].id,
            confidence: "HIGH",
          });
        }
        continue;
      }

      if (row.googleId) {
        const byGoogle = await dest.$queryRawUnsafe<Array<{ id: number; email: string }>>(
          `SELECT id, lower(trim(email)) AS email FROM "User" WHERE "googleId" = $1 LIMIT 1`,
          row.googleId,
        );
        if (byGoogle[0] && byGoogle[0].email !== row.email) {
          mapPreview.push({
            sourceUserId: row.id,
            email: row.email,
            resolution: "MANUAL_REVIEW",
            canonicalUserId: byGoogle[0].id,
            confidence: "LOW",
          });
          continue;
        }
      }

      mapPreview.push({
        sourceUserId: row.id,
        email: row.email,
        resolution: "CREATE_CANONICAL_USER",
        canonicalUserId: null,
        confidence: "MEDIUM",
      });
    }

    const summary = {
      match: mapPreview.filter((m) =>
        m.resolution === "MATCH_EMAIL_VERIFIED" ||
        m.resolution === "MATCH_EXTERNAL_IDENTITY",
      ).length,
      create: mapPreview.filter((m) => m.resolution === "CREATE_CANONICAL_USER").length,
      manual: mapPreview.filter((m) => m.resolution === "MANUAL_REVIEW").length,
      invalid: mapPreview.filter((m) => m.resolution === "INVALID").length,
    };
    console.log("map_summary", summary);

    for (const email of [
      "dnxfotografia@gmail.com",
      "rodrigorincon40@gmail.com",
      "tammytamerph@gmail.com",
    ]) {
      const s = sourceUserRows.find((u) => u.email === email);
      const m = mapPreview.find((u) => u.email === email);
      console.log("admin_probe", {
        email,
        inSource: Boolean(s),
        resolution: m?.resolution ?? null,
        canonicalUserId: m?.canonicalUserId ?? null,
        fmt: s?.fmt ?? null,
      });
    }

    if (mode === "dry-run") {
      console.log(`
DRY-RUN OK — no se escribió nada.

Antes de --execute:
1. Backup Neon origen (backup-before-identity-cutover)
2. Backup Neon destino (backup-before-clickaton-import)
3. prisma migrate deploy en DEST (ClickatonLegacyUserMap)
4. Alinear FotoRank Preview a DEST
5. Resolver MANUAL_REVIEW=${summary.manual}
6. CLICKATON_CUTOVER_CONFIRM=STAGING_IDENTITY_CUTOVER --execute
`);
      return;
    }

    if (mapTable !== 1) {
      throw new Error(
        "DEST no tiene tabla ClickatonLegacyUserMap. Corré prisma migrate deploy primero.",
      );
    }
    if (summary.manual > 0 && process.env.CLICKATON_CUTOVER_ALLOW_MANUAL !== "1") {
      throw new Error(
        `Hay ${summary.manual} MANUAL_REVIEW. Resolver o CLICKATON_CUTOVER_ALLOW_MANUAL=1`,
      );
    }

    const batchId = `cutover-${new Date().toISOString()}`;
    console.log(`execute batchId=${batchId}`);

    for (const item of mapPreview) {
      let canonicalUserId = item.canonicalUserId;
      if (item.resolution === "CREATE_CANONICAL_USER") {
        const src = sourceUserRows.find((u) => u.id === item.sourceUserId);
        if (!src) continue;
        const inserted = await dest.$queryRawUnsafe<Array<{ id: number }>>(
          `INSERT INTO "User" (email, name, role, "googleId", "emailVerifiedAt", password, "createdAt")
           VALUES ($1, $2, $3::"Role", $4, $5, $6, $7)
           ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
           RETURNING id`,
          src.email,
          src.name,
          src.role,
          src.googleId,
          src.emailVerifiedAt,
          src.password,
          src.createdAt,
        );
        canonicalUserId = inserted[0]?.id ?? null;
      }

      const id = `clum_${item.sourceUserId}_${randomBytes(4).toString("hex")}`;
      await dest.$executeRawUnsafe(
        `INSERT INTO "ClickatonLegacyUserMap"
          ("id", "sourceUserId", "canonicalUserId", "normalizedEmail", "resolution", "confidence", "batchId", "migratedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::"ClickatonLegacyUserResolution", $6, $7, NOW(), NOW(), NOW())
         ON CONFLICT ("sourceUserId") DO UPDATE SET
           "canonicalUserId" = EXCLUDED."canonicalUserId",
           "resolution" = EXCLUDED."resolution",
           "confidence" = EXCLUDED."confidence",
           "batchId" = EXCLUDED."batchId",
           "migratedAt" = NOW(),
           "updatedAt" = NOW()`,
        id,
        item.sourceUserId,
        canonicalUserId,
        item.email,
        item.resolution,
        item.confidence,
        batchId,
      );
    }

    console.log(`
EXECUTE PHASE 1 OK — usuarios canónicos + ClickatonLegacyUserMap.

PHASE 2 (dominio: 6 ediciones, fases, productos, FKs) NO se ejecuta en este
comando hasta que el mapa esté verde y existan backups verificados.
Usar el checklist en STAGING_SHARED_IDENTITY_CUTOVER_REPORT.md.
`);
  } finally {
    await source.$disconnect();
    await dest.$disconnect();
  }
}

main().catch((err) => {
  console.error("CUTOVER FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
