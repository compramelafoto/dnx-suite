/**
 * Limpieza de la campaña "[DEMO COMERCIAL] DNX Partners".
 *
 * Borra TODO lo que creó el seed, y solo eso: se guía por el prefijo del slug
 * de partner. Nada que no empiece con ese prefijo se toca.
 *
 * Lleva las mismas guardas que el seed: aborta si NODE_ENV=production, si la
 * DATABASE_URL no apunta a un host local, o si hay variables de publicación
 * multi-base en el entorno.
 *
 * Uso:
 *   # ver qué se borraría, sin borrar
 *   DATABASE_URL=postgresql://...@localhost:5432/dnx \
 *     pnpm --filter clickaton exec tsx scripts/partners-demo-comercial-cleanup.ts --dry-run
 *
 *   # borrar
 *   DATABASE_URL=postgresql://...@localhost:5432/dnx \
 *     pnpm --filter clickaton exec tsx scripts/partners-demo-comercial-cleanup.ts
 */
import { prisma } from "@repo/db";
import {
  DEMO_PREFIX,
  DEMO_SLUG_PREFIX,
  DemoGuardError,
  assertSafeEnvironment,
} from "./partners-demo-comercial-shared";

const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string) {
  console.log(msg);
}

async function main() {
  log(`\n=== Limpieza ${DEMO_PREFIX} DNX Partners ===`);

  const { hostLabel } = assertSafeEnvironment("Limpieza");
  log(`Destino verificado: ${hostLabel}`);

  // Identificación por prefijo de slug. Es la única fuente de verdad.
  const partners = await prisma.dnxPartner.findMany({
    where: { slug: { startsWith: DEMO_SLUG_PREFIX } },
    select: { id: true, slug: true, name: true },
  });

  if (partners.length === 0) {
    log(`\nNo hay nada que borrar: ningún partner con slug "${DEMO_SLUG_PREFIX}*".`);
    return;
  }

  const partnerIds = partners.map((p) => p.id);
  log(`\nPartners de demostración encontrados: ${partners.length}`);
  for (const p of partners) log(`  · ${p.name}  (${p.slug})`);

  // Recuento antes de tocar nada.
  const campaigns = await prisma.dnxPartnerCampaign.findMany({
    where: { partnerId: { in: partnerIds } },
    select: { id: true },
  });
  const campaignIds = campaigns.map((c) => c.id);

  const links = await prisma.dnxPartnerOutboundLink.findMany({
    where: { partnerId: { in: partnerIds } },
    select: { id: true },
  });
  const linkIds = links.map((l) => l.id);

  const counts = {
    clicks: await prisma.dnxPartnerClickEvent.count({
      where: { partnerId: { in: partnerIds } },
    }),
    impressions: await prisma.dnxPartnerImpressionEvent.count({
      where: { partnerId: { in: partnerIds } },
    }),
    bindings: await prisma.dnxPartnerCampaignPlacement.count({
      where: { campaignId: { in: campaignIds } },
    }),
    creatives: await prisma.dnxPartnerCampaignCreative.count({
      where: { campaignId: { in: campaignIds } },
    }),
    campaigns: campaignIds.length,
    links: linkIds.length,
    participations: await prisma.dnxPartnerParticipation.count({
      where: { partnerId: { in: partnerIds } },
    }),
    assets: await prisma.dnxPartnerAsset.count({
      where: { partnerId: { in: partnerIds } },
    }),
    partners: partners.length,
  };

  log(`\nSe borraría:`);
  for (const [k, v] of Object.entries(counts)) {
    log(`  ${k.padEnd(16)} ${String(v).padStart(4)}`);
  }

  if (DRY_RUN) {
    log(`\n--dry-run: no se borró nada.`);
    return;
  }

  // Orden inverso a las dependencias. Todo en una transacción:
  // si algo falla, no queda a medio borrar.
  await prisma.$transaction([
    prisma.dnxPartnerClickEvent.deleteMany({
      where: { partnerId: { in: partnerIds } },
    }),
    prisma.dnxPartnerImpressionEvent.deleteMany({
      where: { partnerId: { in: partnerIds } },
    }),
    prisma.dnxPartnerCampaignPlacement.deleteMany({
      where: { campaignId: { in: campaignIds } },
    }),
    prisma.dnxPartnerCampaignCreative.deleteMany({
      where: { campaignId: { in: campaignIds } },
    }),
    prisma.dnxPartnerCampaign.deleteMany({
      where: { partnerId: { in: partnerIds } },
    }),
    prisma.dnxPartnerOutboundLink.deleteMany({
      where: { partnerId: { in: partnerIds } },
    }),
    prisma.dnxPartnerParticipation.deleteMany({
      where: { partnerId: { in: partnerIds } },
    }),
    prisma.dnxPartnerAsset.deleteMany({
      where: { partnerId: { in: partnerIds } },
    }),
    prisma.dnxPartner.deleteMany({
      where: { id: { in: partnerIds } },
    }),
  ]);

  log(`\n✓ Borrado completo.`);
  log(
    `Nota: el catálogo de placements (DnxPartnerAdPlacement) NO se toca. Es la ` +
      `definición de superficies del sistema, no datos de demostración.`,
  );
}

main()
  .catch((err) => {
    if (err instanceof DemoGuardError) {
      console.error(`\n✖ ${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
