/**
 * Publica participaciones Clickatón READY (logo aprobado / PERSON) en producción.
 *
 * Dry-run (default):
 *   CLICKATON_PRODUCTION_DATABASE_URL=… \
 *   pnpm --filter @repo/db exec tsx scripts/publish-clickaton-ready-partners.mts
 *
 * Apply:
 *   … --apply --confirm-clickaton-production-publish
 *
 * No convierte PROSPECT. No publica sin logo (salvo PERSON/GOVERNMENT).
 */
import { readFileSync, existsSync } from "node:fs";
import { createPartnersService } from "@repo/partners";
import { PrismaClient } from "@prisma/client";
import { createPrismaPartnersRepository } from "../src/partners-prisma-repository.ts";

const ALLOWED_HOST = "ep-silent-haze";
const DENY_HOSTS = ["ep-dawn-dew", "ep-round-fog", "dawn-dew", "round-fog"];

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile("/tmp/clickaton-production-db-etapa13.env");

const url =
  process.env.CLICKATON_PRODUCTION_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(JSON.stringify({ ok: false, reason: "missing_DATABASE_URL" }));
  process.exit(1);
}
const host = new URL(url).hostname;
if (!host.includes(ALLOWED_HOST) || DENY_HOSTS.some((d) => host.includes(d))) {
  console.error(JSON.stringify({ ok: false, reason: "host_denied", hostPrefix: host.slice(0, 18) }));
  process.exit(1);
}
if (!url.includes("clickaton_production")) {
  console.error(JSON.stringify({ ok: false, reason: "db_name_mismatch" }));
  process.exit(1);
}

const apply = hasFlag("--apply");
const confirm = hasFlag("--confirm-clickaton-production-publish");
if (apply && !confirm) {
  console.error(
    JSON.stringify({
      ok: false,
      reason: "missing_--confirm-clickaton-production-publish",
    }),
  );
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const ops = { userId: 1, isOpsAdmin: true as const };
const svc = createPartnersService(createPrismaPartnersRepository(prisma));

const rows = await prisma.dnxPartnerParticipation.findMany({
  where: {
    application: "CLICKATON",
    archivedAt: null,
    publicVisibility: "HIDDEN",
    status: { in: ["CONFIRMED", "ACTIVE", "COMPLETED"] },
  },
  include: {
    partner: {
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        logoUrl: true,
        brandAssets: {
          where: { archivedAt: null, status: "ACTIVE", approvalStatus: "APPROVED" },
          select: { id: true, type: true, fileUrl: true, storageKey: true },
        },
      },
    },
  },
});

const plan: Array<{
  participationId: string;
  partner: string;
  type: string;
  action: "PUBLISH" | "SKIP";
  reason: string;
}> = [];

for (const r of rows) {
  if (r.partner.status === "PROSPECT") {
    plan.push({
      participationId: r.id,
      partner: r.partner.name,
      type: r.partner.type,
      action: "SKIP",
      reason: "PROSPECT",
    });
    continue;
  }
  const commercial = r.partner.type !== "PERSON" && r.partner.type !== "GOVERNMENT";
  const hasApproved = r.partner.brandAssets.some((a) => a.fileUrl || a.storageKey);
  if (commercial && !hasApproved) {
    plan.push({
      participationId: r.id,
      partner: r.partner.name,
      type: r.partner.type,
      action: "SKIP",
      reason: "MISSING_LOGO",
    });
    continue;
  }
  plan.push({
    participationId: r.id,
    partner: r.partner.name,
    type: r.partner.type,
    action: "PUBLISH",
    reason: hasApproved ? "READY_LOGO" : "PERSON_OR_GOV",
  });
}

const toPublish = plan.filter((p) => p.action === "PUBLISH");
console.log(
  JSON.stringify(
    {
      dryRun: !apply,
      hostPrefix: host.slice(0, 18),
      candidates: plan.length,
      toPublish: toPublish.length,
      plan,
    },
    null,
    2,
  ),
);

if (!apply) {
  await prisma.$disconnect();
  process.exit(0);
}

const results: Array<{ partner: string; ok: boolean; error?: string }> = [];
for (const p of toPublish) {
  try {
    await svc.publishParticipation(ops, p.participationId, {
      allowWithoutLogo: p.type === "PERSON" || p.type === "GOVERNMENT",
    });
    results.push({ partner: p.partner, ok: true });
  } catch (err) {
    results.push({
      partner: p.partner,
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

console.log(JSON.stringify({ applied: true, results }, null, 2));
await prisma.$disconnect();
