/**
 * Seed SFEF institutional partners on FotoRank production (ep-dawn-dew).
 *
 *   FOTORANK_PRODUCTION_DATABASE_URL=… \
 *   pnpm --filter @repo/db exec tsx scripts/seed-sfef-partners-production.mts \
 *     --confirm-fotorank-production-seed \
 *     --contest-id=cmsf1je750005xpzcrizp52rd
 */
import { createPartnersService, type DnxPartnerInstitutionalRole } from "@repo/partners";
import { createPrismaPartnersRepository } from "../src/partners-prisma-repository.ts";

const ALLOWED_HOST = "ep-dawn-dew";
const CONTEST_ID_DEFAULT = "cmsf1je750005xpzcrizp52rd";

const ORGS = [
  {
    slug: "sfpr",
    name: "Sociedad de Fotógrafos Profesionales de Rosario",
    legalName: "Sociedad de Fotógrafos Profesionales de Rosario",
    institutionalRole: "ORGANIZER" as DnxPartnerInstitutionalRole,
    title: "Organizador",
    displayOrder: 10,
  },
  {
    slug: "camara-senadores-santa-fe",
    name: "Cámara de Senadores de la Provincia de Santa Fe",
    legalName: "Cámara de Senadores de la Provincia de Santa Fe",
    institutionalRole: "CO_ORGANIZER" as DnxPartnerInstitutionalRole,
    title: "Coorganizador",
    displayOrder: 20,
  },
] as const;

function hasFlag(name: string) {
  return process.argv.includes(name);
}
function flagValue(name: string): string | null {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1) || null;
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  if (!hasFlag("--confirm-fotorank-production-seed")) {
    console.log(JSON.stringify({ status: "SKIPPED", reason: "missing_confirm" }));
    process.exit(2);
  }
  const url = process.env.FOTORANK_PRODUCTION_DATABASE_URL?.trim();
  if (!url) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "URL_absent" }));
    process.exit(1);
  }
  const host = new URL(url).hostname;
  if (!host.includes(ALLOWED_HOST) || host.includes("round-fog") || host.includes("silent-haze")) {
    console.log(
      JSON.stringify({ status: "BLOCKED", reason: "host_guard", hostHint: host.slice(0, 24) }),
    );
    process.exit(1);
  }

  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = process.env.FOTORANK_PRODUCTION_DIRECT_URL || url;

  const contestId = flagValue("--contest-id") || CONTEST_ID_DEFAULT;
  const { prisma } = await import("../src/client.ts");
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, slug: true, title: true },
  });
  if (!contest) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "contest_not_found", contestId }));
    process.exit(1);
  }

  const svc = createPartnersService(createPrismaPartnersRepository());
  const actor = { userId: 0, isOpsAdmin: true as const };
  const partners: Array<Record<string, unknown>> = [];

  for (const org of ORGS) {
    let partner = await prisma.dnxPartner.findUnique({ where: { slug: org.slug } });
    let created = false;
    if (!partner) {
      partner = await svc.createPartner(actor, {
        name: org.name,
        legalName: org.legalName,
        slug: org.slug,
        type: "INSTITUTION",
        status: "ACTIVE",
      });
      created = true;
    } else if (partner.status === "ARCHIVED" || partner.status === "PROSPECT") {
      partner = await svc.updatePartner(actor, partner.id, {
        status: "ACTIVE",
        name: org.name,
        legalName: org.legalName,
      });
    }

    const existing = await prisma.dnxPartnerParticipation.findMany({
      where: {
        partnerId: partner.id,
        application: "FOTO_RANK",
        contextType: "CONTEST",
        contextId: contestId,
        archivedAt: null,
        status: { notIn: ["ARCHIVED", "CANCELLED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 1,
    });

    let participationId: string;
    let participationCreated = false;
    if (existing[0]) {
      participationId = existing[0].id;
      await svc.updateParticipation(actor, participationId, {
        institutionalRole: org.institutionalRole,
        displayTier: "INSTITUTIONAL",
        displayOrder: org.displayOrder,
        title: org.title,
        status:
          existing[0].status === "ACTIVE" || existing[0].status === "CONFIRMED"
            ? existing[0].status
            : "CONFIRMED",
        requiresPayment: false,
        paymentMode: "NONE",
      });
    } else {
      const { participation } = await svc.createParticipation(actor, {
        partnerId: partner.id,
        application: "FOTO_RANK",
        contextType: "CONTEST",
        contextId: contestId,
        institutionalRole: org.institutionalRole,
        displayTier: "INSTITUTIONAL",
        displayOrder: org.displayOrder,
        status: "CONFIRMED",
        requiresPayment: false,
        paymentMode: "NONE",
        title: org.title,
      });
      participationId = participation.id;
      participationCreated = true;
    }

    partners.push({
      slug: org.slug,
      created,
      participationCreated,
      participationId,
      institutionalRole: org.institutionalRole,
    });
  }

  console.log(
    JSON.stringify({
      status: "SEEDED",
      contest: { id: contest.id, slug: contest.slug },
      partners,
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(JSON.stringify({ status: "FAILED", message: String(e).slice(0, 400) }));
  process.exit(1);
});
