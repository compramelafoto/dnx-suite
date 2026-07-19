/**
 * Auditoría 10D2 del schema/migración Clickatón registrations.
 *
 * Modos:
 *   1) Por defecto: inspecciona migration.sql (sin DB, sin .env).
 *   2) --url <postgres>: SELECT-only contra base aislada (bloquea Neon compartida).
 *
 * Nunca carga packages/db/.env. Nunca ejecuta DDL.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIG_NAME = "20260718220000_clickaton_registrations_credentials_checkin_kits";
const __dir = dirname(fileURLToPath(import.meta.url));
const MIG_PATH = join(__dir, "..", "prisma", "migrations", MIG_NAME, "migration.sql");

const REQUIRED_TABLES = [
  "ClickatonEditionSequence",
  "ClickatonTicketType",
  "ClickatonProduct",
  "ClickatonProductVariant",
  "ClickatonTicketTypeItem",
  "ClickatonRegistration",
  "ClickatonRegistrationItem",
  "ClickatonCapacityHold",
  "ClickatonStockHold",
  "ClickatonParticipantCredential",
  "ClickatonQrToken",
  "ClickatonCheckIn",
  "ClickatonKitDelivery",
  "ClickatonKitDeliveryItem",
  "ClickatonRegistrationStatusHistory",
  "ClickatonRegistrationAudit",
] as const;

const REQUIRED_ENUMS = [
  "ClickatonRegistrationStatus",
  "ClickatonPaymentStatus",
  "ClickatonHoldStatus",
  "ClickatonCredentialStatus",
  "ClickatonQrTokenStatus",
  "ClickatonKitDeliveryStatus",
  "ClickatonCheckInSource",
] as const;

const FORBIDDEN_SENSITIVE = [
  "medicalDiagnosis",
  "clinicalNotes",
  "healthCoverageDetail",
  "bloodType",
  "allergyList",
] as const;

const PARTIAL_INDEXES = [
  "ClickatonCheckIn_registrationId_active_key",
  "ClickatonQrToken_credentialId_active_key",
  "ClickatonKitDelivery_registrationId_active_key",
] as const;

function sanitizeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid-url)";
  }
}

function assertSafeUrl(url: string): void {
  const host = sanitizeHost(url).toLowerCase();
  if (host.includes("ep-dawn-dew") || host.includes("neon.tech")) {
    console.error(`ABORT: host=${sanitizeHost(url)} — Neon bloqueada para esta auditoría write-capable.`);
    console.error("Usar modo SQL-only (sin --url) o Postgres local descartable.");
    process.exit(2);
  }
}

function auditSql(sql: string) {
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];

  checks.no_drop_table = !/^\s*DROP\s+TABLE\b/im.test(sql);
  checks.no_drop_column = !/^\s*DROP\s+COLUMN\b/im.test(sql);
  if (!checks.no_drop_table) errors.push("DROP TABLE found");
  if (!checks.no_drop_column) errors.push("DROP COLUMN found");

  for (const t of REQUIRED_TABLES) {
    const ok = sql.includes(`CREATE TABLE "${t}"`);
    checks[`table_${t}`] = ok;
    if (!ok) errors.push(`missing table ${t}`);
  }
  for (const e of REQUIRED_ENUMS) {
    const ok = sql.includes(`CREATE TYPE "${e}"`);
    checks[`enum_${e}`] = ok;
    if (!ok) errors.push(`missing enum ${e}`);
  }

  checks.visible_code_unique = sql.includes('ClickatonRegistration_editionId_visibleCode_key');
  checks.sequence_unique = sql.includes('ClickatonRegistration_editionId_sequenceNumber_key');
  checks.token_hash_unique = sql.includes('ClickatonQrToken_tokenHash_key');
  checks.restrict_fks = (sql.match(/ON DELETE RESTRICT/g) ?? []).length >= 20;
  checks.no_float_money =
    !/priceAmount["\s]+DOUBLE|FLOAT|REAL/i.test(sql) &&
    sql.includes('"priceAmount" INTEGER') &&
    sql.includes('"totalAmount" INTEGER');
  checks.qr_hash_column = sql.includes('"tokenHash" TEXT NOT NULL');
  checks.payment_status_column = sql.includes('"paymentStatus" "ClickatonPaymentStatus"');
  checks.visible_code_prefix = sql.includes('"visibleCodePrefix"');

  for (const idx of PARTIAL_INDEXES) {
    const ok = sql.includes(idx) && sql.includes("WHERE");
    checks[`partial_${idx}`] = ok;
    if (!ok) errors.push(`missing partial index ${idx}`);
  }

  for (const col of FORBIDDEN_SENSITIVE) {
    const present = sql.includes(col);
    checks[`no_sensitive_${col}`] = !present;
    if (present) errors.push(`unexpected sensitive column ${col}`);
  }

  // No ALTER ajenos a Clickaton* (salvo visibleCodePrefix en Edition)
  const alterTables = [...sql.matchAll(/^\s*ALTER TABLE "([^"]+)"/gim)].map((m) => m[1]!);
  const badAlters = alterTables.filter((t) => !t.startsWith("Clickaton"));
  checks.only_clickaton_alters = badAlters.length === 0;
  if (badAlters.length) errors.push(`non-clickaton ALTER: ${badAlters.join(",")}`);

  return { checks, errors, allOk: errors.length === 0 && Object.values(checks).every(Boolean) };
}

async function auditLive(url: string) {
  assertSafeUrl(url);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'Clickaton%'
      ORDER BY 1
    `;
    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname FROM pg_type
      WHERE typname LIKE 'Clickaton%' AND typtype = 'e'
      ORDER BY 1
    `;
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE 'Clickaton%'
      ORDER BY 1
    `;
    const names = new Set(tables.map((t) => t.tablename));
    const enumNames = new Set(enums.map((e) => e.typname));
    const idxNames = new Set(indexes.map((i) => i.indexname));
    const checks: Record<string, boolean> = {};
    for (const t of REQUIRED_TABLES) checks[`live_table_${t}`] = names.has(t);
    for (const e of REQUIRED_ENUMS) checks[`live_enum_${e}`] = enumNames.has(e);
    for (const i of PARTIAL_INDEXES) checks[`live_idx_${i}`] = idxNames.has(i);
    return {
      host: sanitizeHost(url),
      checks,
      allOk: Object.values(checks).every(Boolean),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--allow-write")) {
    console.error("Refusing --allow-write.");
    process.exit(2);
  }
  const urlIdx = argv.indexOf("--url");
  const url = urlIdx >= 0 ? argv[urlIdx + 1] : undefined;

  if (!existsSync(MIG_PATH)) {
    console.error(`Missing migration: ${MIG_PATH}`);
    process.exit(2);
  }
  const sql = readFileSync(MIG_PATH, "utf8");
  const sha256 = createHash("sha256").update(sql).digest("hex");
  const sqlAudit = auditSql(sql);

  const report: Record<string, unknown> = {
    mode: url ? "sql+live" : "sql",
    migration: MIG_NAME,
    sha256,
    bytes: sql.length,
    sql: sqlAudit,
    neonWrites: 0,
    envLoaded: false,
  };

  if (url) {
    report.live = await auditLive(url);
  }

  const ok =
    sqlAudit.allOk &&
    (report.live ? (report.live as { allOk: boolean }).allOk : true);

  console.log(JSON.stringify(report, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
