/**
 * Seed Clickatón AR 2026 partners from IMP02 operator lists (prod ep-silent-haze).
 *
 * Dry-run (default):
 *   CLICKATON_PRODUCTION_DATABASE_URL=… \
 *   pnpm --filter @repo/db exec tsx scripts/seed-clickaton-partners-imp02.mts
 *
 * Apply:
 *   CLICKATON_PRODUCTION_DATABASE_URL=… \
 *   pnpm --filter @repo/db exec tsx scripts/seed-clickaton-partners-imp02.mts \
 *     --apply --confirm-clickaton-production-seed
 *
 * No MP, no payments, no invented logos. Participations stay publicVisibility=HIDDEN.
 */
import { createPartnersService } from "@repo/partners";
import type { PrismaClient } from "@prisma/client";
import { createPrismaPartnersRepository } from "../src/partners-prisma-repository.ts";
import {
  CLICKATON_PARTNERS_IMP02_CATALOG,
  normalizeLookupName,
  type Imp02CatalogEntry,
  type Imp02ContributionSpec,
} from "./data/clickaton-partners-imp02-catalog.ts";

const ALLOWED_HOST = "ep-silent-haze";
const DENY_HOSTS = ["ep-dawn-dew", "ep-round-fog", "dawn-dew", "round-fog"];
const EDITION_SLUG = "clickaton-argentina-2026";
const EDITION_ID_EXPECTED = "cms78cthj0000xpc4841bihf4";
const RESPONSABLE_RE = /Responsable interno Clickatón:\s*\S+/i;

type RowAction = "CREAR" | "ACTUALIZAR" | "YA_EXISTE" | "AMBIGUO" | "OMITIR";

type SummaryRow = {
  key: string;
  slug: string;
  list: Imp02CatalogEntry["list"];
  action: RowAction;
  partnerId?: string;
  participationId?: string;
  detail?: string;
  contributionsCreated?: number;
  dryRun?: boolean;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function maskHost(host: string): string {
  if (host.length <= 18) return `${host.slice(0, 8)}…`;
  return `${host.slice(0, 14)}…`;
}

function resolveDbUrl(): string | null {
  return (
    process.env.CLICKATON_PRODUCTION_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null
  );
}

function normalizeContactValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim().toLowerCase().replace(/\/+$/, "");
  return t || null;
}

function instagramHandle(urlOrHandle: string | null | undefined): string | null {
  const v = normalizeContactValue(urlOrHandle);
  if (!v) return null;
  const m = v.match(/instagram\.com\/([^/?#]+)/);
  return m?.[1] ?? v.replace(/^@/, "");
}

type PartnerRow = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  description: string | null;
  type: string;
  status: string;
  websiteUrl: string | null;
  instagram: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archivedAt: Date | null;
};

async function findMatchingPartners(
  prisma: PrismaClient,
  entry: Imp02CatalogEntry,
): Promise<PartnerRow[]> {
  const p = entry.partner;
  const bySlug = await prisma.dnxPartner.findUnique({
    where: { slug: p.slug },
  });
  if (bySlug) return [bySlug as PartnerRow];

  const or: Array<Record<string, unknown>> = [
    { name: { equals: p.name, mode: "insensitive" } },
  ];
  if (p.legalName) {
    or.push({ legalName: { equals: p.legalName, mode: "insensitive" } });
  }
  if (p.email) {
    or.push({ email: { equals: p.email, mode: "insensitive" } });
  }
  if (p.websiteUrl) {
    or.push({ websiteUrl: { equals: p.websiteUrl, mode: "insensitive" } });
  }
  if (p.instagram) {
    or.push({ instagram: { equals: p.instagram, mode: "insensitive" } });
    const handle = instagramHandle(p.instagram);
    if (handle) {
      or.push({ instagram: { contains: handle, mode: "insensitive" } });
    }
  }

  const candidates = (await prisma.dnxPartner.findMany({
    where: {
      archivedAt: null,
      OR: or,
    },
  })) as PartnerRow[];

  const targetName = normalizeLookupName(p.name);
  const targetIg = instagramHandle(p.instagram);
  const targetWeb = normalizeContactValue(p.websiteUrl);
  const targetEmail = normalizeContactValue(p.email);

  const filtered = candidates.filter((c) => {
    if (normalizeLookupName(c.name) === targetName) return true;
    if (
      c.legalName &&
      p.legalName &&
      normalizeLookupName(c.legalName) === normalizeLookupName(p.legalName)
    ) {
      return true;
    }
    if (targetEmail && normalizeContactValue(c.email) === targetEmail) return true;
    if (targetWeb && normalizeContactValue(c.websiteUrl) === targetWeb) return true;
    if (targetIg && instagramHandle(c.instagram) === targetIg) return true;
    return false;
  });

  // Deduplicate by id
  const byId = new Map<string, PartnerRow>();
  for (const row of filtered) byId.set(row.id, row);
  return [...byId.values()];
}

function buildSafePartnerUpdate(
  existing: PartnerRow,
  entry: Imp02CatalogEntry,
): Record<string, unknown> | null {
  const p = entry.partner;
  const patch: Record<string, unknown> = {};

  const fillIfEmpty = (
    field: "websiteUrl" | "instagram" | "email" | "phone" | "description" | "legalName",
    incoming: string | null | undefined,
  ) => {
    if (!incoming) return;
    const current = existing[field];
    if (current == null || String(current).trim() === "") {
      patch[field] = incoming;
    }
  };

  fillIfEmpty("websiteUrl", p.websiteUrl);
  fillIfEmpty("instagram", p.instagram);
  fillIfEmpty("email", p.email);
  fillIfEmpty("phone", p.phone);
  fillIfEmpty("description", p.description);
  fillIfEmpty("legalName", p.legalName);

  // Status: promote PROSPECT → ACTIVE for confirmed list only
  if (entry.list === "CONFIRMED" && existing.status === "PROSPECT") {
    patch.status = "ACTIVE";
  }

  // Notes: append responsable / research notes if missing
  const existingNotes = existing.notes?.trim() ?? "";
  const catalogNotes = p.notes.trim();
  if (!existingNotes) {
    patch.notes = catalogNotes;
  } else if (!RESPONSABLE_RE.test(existingNotes) && RESPONSABLE_RE.test(catalogNotes)) {
    const responsableLine =
      catalogNotes.match(/Responsable interno Clickatón:\s*[^\n.]+/i)?.[0] ??
      catalogNotes;
    patch.notes = `${existingNotes}\n\n[IMP02] ${responsableLine}`;
  } else if (!existingNotes.includes("IMP02") && catalogNotes.includes("IMP02")) {
    // Keep research breadcrumb without overwriting operator notes
    patch.notes = `${existingNotes}\n\n[IMP02] ${catalogNotes}`;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

async function ensureParticipation(
  prisma: PrismaClient,
  svc: ReturnType<typeof createPartnersService>,
  actor: { userId: number; isOpsAdmin: true },
  partnerId: string,
  editionId: string,
  entry: Imp02CatalogEntry,
  dryRun: boolean,
): Promise<{ participationId: string; created: boolean; existed: boolean }> {
  const part = entry.participation!;
  const existing = await prisma.dnxPartnerParticipation.findMany({
    where: {
      partnerId,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: editionId,
      archivedAt: null,
      status: { notIn: ["ARCHIVED", "CANCELLED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  if (existing[0]) {
    return {
      participationId: existing[0].id,
      created: false,
      existed: true,
    };
  }

  if (dryRun) {
    return { participationId: "(dry-run)", created: true, existed: false };
  }

  const { participation } = await svc.createParticipation(actor, {
    partnerId,
    application: "CLICKATON",
    contextType: "EDITION",
    contextId: editionId,
    institutionalRole: part.institutionalRole,
    displayTier: part.displayTier ?? "STANDARD",
    status: "CONFIRMED",
    publicVisibility: "HIDDEN",
    requiresPayment: false,
    paymentMode: "NONE",
    title: part.title ?? null,
    notes: part.notes,
  });

  return { participationId: participation.id, created: true, existed: false };
}

async function ensureContributions(
  prisma: PrismaClient,
  svc: ReturnType<typeof createPartnersService>,
  actor: { userId: number; isOpsAdmin: true },
  participationId: string,
  contributions: Imp02ContributionSpec[] | undefined,
  dryRun: boolean,
): Promise<{ created: number; skipped: number }> {
  if (!contributions?.length) return { created: 0, skipped: 0 };
  if (dryRun && participationId === "(dry-run)") {
    return { created: contributions.length, skipped: 0 };
  }

  const existing = await prisma.dnxPartnerContribution.findMany({
    where: { participationId },
    select: { title: true },
  });
  const existingTitles = new Set(
    existing.map((c) => c.title.trim().toLowerCase()),
  );

  let created = 0;
  let skipped = 0;
  for (const c of contributions) {
    if (existingTitles.has(c.title.trim().toLowerCase())) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      created += 1;
      continue;
    }
    await svc.createContribution(actor, {
      participationId,
      type: c.type,
      title: c.title,
      description: c.description ?? null,
      quantity: c.quantity ?? null,
      status: c.status,
      notes: c.notes ?? null,
    });
    created += 1;
  }
  return { created, skipped };
}

async function main() {
  const apply = hasFlag("--apply");
  const dryRun = !apply || hasFlag("--dry-run");
  const confirm = hasFlag("--confirm-clickaton-production-seed");

  if (apply && !confirm) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason: "missing_--confirm-clickaton-production-seed",
        hint: "Pass --apply --confirm-clickaton-production-seed together",
      }),
    );
    process.exit(2);
  }

  const url = resolveDbUrl();
  if (!url) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "URL_absent",
        detail: "Set CLICKATON_PRODUCTION_DATABASE_URL or DATABASE_URL",
      }),
    );
    process.exit(1);
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "URL_invalid" }));
    process.exit(1);
  }

  if (DENY_HOSTS.some((d) => host.includes(d))) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "denylist_host",
        hostHint: maskHost(host),
        denylist: DENY_HOSTS,
      }),
    );
    process.exit(1);
  }
  if (!host.includes(ALLOWED_HOST)) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "host_not_allowlisted",
        hostHint: maskHost(host),
        expected: ALLOWED_HOST,
      }),
    );
    process.exit(1);
  }

  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL =
    process.env.CLICKATON_PRODUCTION_DIRECT_URL?.trim() || url;

  const { prisma } = await import("../src/client.ts");

  const publishedCount = await prisma.clickatonEdition.count({
    where: { isPublished: true },
  });

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: EDITION_SLUG },
    select: { id: true, slug: true, name: true, isPublished: true, status: true },
  });

  if (!edition) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "edition_slug_missing",
        slug: EDITION_SLUG,
        publishedEditions: publishedCount,
      }),
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  if (edition.id !== EDITION_ID_EXPECTED) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "edition_id_mismatch",
        slug: edition.slug,
        foundId: edition.id,
        expectedId: EDITION_ID_EXPECTED,
        publishedEditions: publishedCount,
      }),
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  if (publishedCount === 0 || publishedCount > 1) {
    // Informative only — slug match is authoritative
    console.error(
      JSON.stringify({
        warning: "published_editions_count_unusual",
        publishedEditions: publishedCount,
        usingSlug: EDITION_SLUG,
        editionId: edition.id,
      }),
    );
  }

  const svc = createPartnersService(createPrismaPartnersRepository());
  const actor = { userId: 0, isOpsAdmin: true as const };

  const rows: SummaryRow[] = [];
  const counts: Record<RowAction, number> = {
    CREAR: 0,
    ACTUALIZAR: 0,
    YA_EXISTE: 0,
    AMBIGUO: 0,
    OMITIR: 0,
  };

  for (const entry of CLICKATON_PARTNERS_IMP02_CATALOG) {
    try {
      const matches = await findMatchingPartners(prisma, entry);

      if (matches.length > 1) {
        const row: SummaryRow = {
          key: entry.key,
          slug: entry.partner.slug,
          list: entry.list,
          action: "AMBIGUO",
          detail: `matches=${matches.map((m) => `${m.slug}:${m.id}`).join(",")}`,
          dryRun,
        };
        rows.push(row);
        counts.AMBIGUO += 1;
        continue;
      }

      let partnerId: string | undefined;
      let action: RowAction;
      let detail = "";

      if (matches.length === 0) {
        action = "CREAR";
        if (!dryRun) {
          const created = await svc.createPartner(actor, {
            name: entry.partner.name,
            legalName: entry.partner.legalName ?? null,
            slug: entry.partner.slug,
            type: entry.partner.type,
            status: entry.partner.status,
            websiteUrl: entry.partner.websiteUrl ?? null,
            instagram: entry.partner.instagram ?? null,
            email: entry.partner.email ?? null,
            phone: entry.partner.phone ?? null,
            description: entry.partner.description ?? null,
            notes: entry.partner.notes,
          });
          partnerId = created.id;
          detail = "partner_created";
        } else {
          detail = "would_create_partner";
        }
      } else {
        const existing = matches[0]!;
        partnerId = existing.id;
        const patch = buildSafePartnerUpdate(existing, entry);
        if (patch) {
          action = "ACTUALIZAR";
          if (!dryRun) {
            await svc.updatePartner(actor, existing.id, patch);
            detail = `safe_fields=${Object.keys(patch).join(",")}`;
          } else {
            detail = `would_update=${Object.keys(patch).join(",")}`;
          }
        } else {
          action = "YA_EXISTE";
          detail = "partner_unchanged";
        }
      }

      let participationId: string | undefined;
      let contributionsCreated = 0;

      if (entry.list === "CONFIRMED" && entry.participation) {
        if (!partnerId && dryRun) {
          // Would create partner + participation
          detail = `${detail};would_create_participation`;
          contributionsCreated = entry.contributions?.length ?? 0;
        } else if (partnerId) {
          const partResult = await ensureParticipation(
            prisma,
            svc,
            actor,
            partnerId,
            edition.id,
            entry,
            dryRun,
          );
          participationId =
            partResult.participationId === "(dry-run)"
              ? undefined
              : partResult.participationId;

          if (partResult.existed) {
            if (action === "CREAR") {
              // unlikely: new partner but existing participation
              detail = `${detail};participation_ya_existe`;
            } else if (action === "YA_EXISTE") {
              detail = `${detail};participation_ya_existe`;
            } else {
              detail = `${detail};participation_ya_existe`;
            }
          } else {
            detail = `${detail};participation_${dryRun ? "would_create" : "created"}`;
            if (action === "YA_EXISTE") action = "ACTUALIZAR";
          }

          const contribResult = await ensureContributions(
            prisma,
            svc,
            actor,
            partResult.participationId,
            entry.contributions,
            dryRun,
          );
          contributionsCreated = contribResult.created;
          if (contribResult.created > 0 && action === "YA_EXISTE") {
            action = "ACTUALIZAR";
          }
          if (contribResult.created > 0) {
            detail = `${detail};contributions_${dryRun ? "would_create" : "created"}=${contribResult.created}`;
          } else if (contribResult.skipped > 0) {
            detail = `${detail};contributions_ya_existe=${contribResult.skipped}`;
          } else if (!entry.contributions?.length) {
            detail = `${detail};contributions_none`;
          }
        }
      } else {
        detail = `${detail};prospect_no_participation`;
      }

      const row: SummaryRow = {
        key: entry.key,
        slug: entry.partner.slug,
        list: entry.list,
        action,
        partnerId,
        participationId,
        detail,
        contributionsCreated,
        dryRun,
      };
      rows.push(row);
      counts[action] += 1;
    } catch (err) {
      const row: SummaryRow = {
        key: entry.key,
        slug: entry.partner.slug,
        list: entry.list,
        action: "OMITIR",
        detail: `error=${String(err).slice(0, 240)}`,
        dryRun,
      };
      rows.push(row);
      counts.OMITIR += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        status: dryRun ? "DRY_RUN" : "SEEDED",
        mode: dryRun ? "dry-run" : "apply",
        hostHint: maskHost(host),
        edition: {
          id: edition.id,
          slug: edition.slug,
          name: edition.name,
          isPublished: edition.isPublished,
        },
        publishedEditions: publishedCount,
        catalogSize: CLICKATON_PARTNERS_IMP02_CATALOG.length,
        counts: {
          CREAR: counts.CREAR,
          ACTUALIZAR: counts.ACTUALIZAR,
          YA_EXISTE: counts.YA_EXISTE,
          AMBIGUO: counts.AMBIGUO,
          OMITIR: counts.OMITIR,
        },
        rows,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(
    JSON.stringify({
      status: "FAILED",
      message: String(e).slice(0, 400),
    }),
  );
  process.exit(1);
});
