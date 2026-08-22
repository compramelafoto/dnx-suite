/**
 * Seed de la campaña "[DEMO COMERCIAL] DNX Partners".
 *
 * Crea tres marcas ficticias con sus logos, participaciones globales, campañas,
 * creatividades, vinculación a placements y enlaces de seguimiento, para poder
 * capturar la publicidad andando en Clickatón, FotoRank, InfoSpot y ComprameLaFoto.
 *
 * Es idempotente: correrlo dos veces no duplica nada.
 *
 * NUNCA publica a otras bases: si detecta DNX_PARTNERS_*_DATABASE_URL en el
 * entorno, aborta antes de conectarse.
 *
 * Uso:
 *   # ver el plan sin escribir nada
 *   DATABASE_URL=postgresql://...@localhost:5432/dnx \
 *     pnpm --filter clickaton exec tsx scripts/partners-demo-comercial-seed.ts --dry-run
 *
 *   # aplicar
 *   DATABASE_URL=postgresql://...@localhost:5432/dnx \
 *     pnpm --filter clickaton exec tsx scripts/partners-demo-comercial-seed.ts
 *
 * Para borrar todo después: scripts/partners-demo-comercial-cleanup.ts
 */
import { prisma } from "@repo/db";
import { ensureAdPlacementCatalog } from "@repo/db/partners-ads-loader";
import {
  DEMO_BRANDS,
  DEMO_PREFIX,
  DemoGuardError,
  EXPECTED_PLACEMENT_KEYS,
  assertSafeEnvironment,
  demoCampaignName,
  demoDestinationBaseUrl,
  demoDestinationUrl,
  demoTrackingKey,
  type DemoBrand,
} from "./partners-demo-comercial-shared";

const DRY_RUN = process.argv.includes("--dry-run");

type Counters = {
  partners: number;
  assets: number;
  participations: number;
  campaigns: number;
  creatives: number;
  bindings: number;
  links: number;
};

const created: Counters = {
  partners: 0,
  assets: 0,
  participations: 0,
  campaigns: 0,
  creatives: 0,
  bindings: 0,
  links: 0,
};
const reused: Counters = { ...created };

function log(msg: string) {
  console.log(msg);
}

/* ------------------------------------------------------------------ */

async function seedBrand(brand: DemoBrand) {
  // Destino propio por marca, para que la landing sepa de dónde vino el clic.
  const destinationUrl = demoDestinationUrl(brand.slug);
  log(`\n▸ ${brand.name}`);

  // 1. Partner — slug es único, así que upsert basta.
  const partner = await prisma.dnxPartner.upsert({
    where: { slug: brand.slug },
    create: {
      slug: brand.slug,
      name: brand.name,
      description: brand.description,
      type: "BRAND",
      status: "ACTIVE",
      websiteUrl: destinationUrl,
      logoUrl: brand.assetFile,
      notes: `${DEMO_PREFIX} Marca ficticia. Creada por partners-demo-comercial-seed.ts.`,
    },
    update: {
      name: brand.name,
      description: brand.description,
      status: "ACTIVE",
      websiteUrl: destinationUrl,
      logoUrl: brand.assetFile,
      archivedAt: null,
    },
  });
  const partnerExisted = partner.createdAt.getTime() !== partner.updatedAt.getTime();
  partnerExisted ? reused.partners++ : created.partners++;
  log(`   partner   ${partnerExisted ? "reutilizado" : "creado"}  ${partner.id}`);

  // 2. Asset — no tiene clave única natural; se busca por partner + nombre.
  const assetName = `${brand.name} — logotipo`;
  let asset = await prisma.dnxPartnerAsset.findFirst({
    where: { partnerId: partner.id, name: assetName },
  });
  const assetData = {
    type: brand.assetType,
    storageProvider: "EXTERNAL" as const,
    fileUrl: brand.assetFile,
    mimeType: "image/svg+xml",
    fileExtension: "svg",
    width: brand.width,
    height: brand.height,
    aspectRatio: brand.aspectRatio,
    backgroundType: "COLOR" as const,
    isPrimary: true,
    status: "ACTIVE" as const,
    approvalStatus: "APPROVED" as const,
    altText: brand.name,
    approvedAt: new Date(),
    archivedAt: null,
  };
  if (asset) {
    asset = await prisma.dnxPartnerAsset.update({
      where: { id: asset.id },
      data: assetData,
    });
    reused.assets++;
  } else {
    asset = await prisma.dnxPartnerAsset.create({
      data: { partnerId: partner.id, name: assetName, ...assetData },
    });
    created.assets++;
  }
  log(`   asset     ${asset.id}  ${brand.assetFile}`);

  // Pieza gráfica completa: segundo asset, solo para las creatividades welcome.
  let creativeAsset: typeof asset | null = null;
  if (brand.creativeFile) {
    const creativeName = `${brand.name} — pieza gráfica`;
    const found = await prisma.dnxPartnerAsset.findFirst({
      where: { partnerId: partner.id, name: creativeName },
    });
    const data = {
      type: "BRAND_PHOTO" as const,
      storageProvider: "EXTERNAL" as const,
      fileUrl: brand.creativeFile,
      mimeType: "image/jpeg",
      fileExtension: "jpg",
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      backgroundType: "COLOR" as const,
      isPrimary: false,
      status: "ACTIVE" as const,
      approvalStatus: "APPROVED" as const,
      altText: brand.name,
      approvedAt: new Date(),
      archivedAt: null,
    };
    creativeAsset = found
      ? await prisma.dnxPartnerAsset.update({ where: { id: found.id }, data })
      : await prisma.dnxPartnerAsset.create({
          data: { partnerId: partner.id, name: creativeName, ...data },
        });
    found ? reused.assets++ : created.assets++;
    log(`   gráfica   ${creativeAsset.id}  ${brand.creativeFile}`);
  }

  // 3. Una campaña por aplicación.
  for (const plan of brand.campaigns) {
    // 3a. Participación GLOBAL: sin ella los marquees de Clickatón y las placas
    //     de FotoRank y CLF descartan la campaña (null participation ≠ global).
    let participation = await prisma.dnxPartnerParticipation.findFirst({
      where: {
        partnerId: partner.id,
        application: plan.application,
        contextType: "GLOBAL",
      },
    });
    const participationData = {
      participationType: "SPONSOR" as const,
      institutionalRole: "SPONSOR" as const,
      displayTier: "STANDARD" as const,
      publicVisibility: "PUBLIC" as const,
      status: "ACTIVE" as const,
      clickTrackingEnabled: true,
      destinationUrl,
      title: brand.name,
      requiresPayment: false,
      paymentMode: "NONE" as const,
      notes: `${DEMO_PREFIX} Participación global de demostración.`,
      startsAt: null,
      endsAt: null,
      archivedAt: null,
    };
    if (participation) {
      participation = await prisma.dnxPartnerParticipation.update({
        where: { id: participation.id },
        data: participationData,
      });
      reused.participations++;
    } else {
      participation = await prisma.dnxPartnerParticipation.create({
        data: {
          partnerId: partner.id,
          application: plan.application,
          contextType: "GLOBAL",
          contextId: null,
          ...participationData,
        },
      });
      created.participations++;
    }

    // 3b. Campaña.
    const campaignName = demoCampaignName(brand.name, plan.application);
    let campaign = await prisma.dnxPartnerCampaign.findFirst({
      where: { partnerId: partner.id, name: campaignName },
    });
    const campaignData = {
      description: `${DEMO_PREFIX} Campaña de demostración para capturas comerciales.`,
      application: plan.application,
      status: "ACTIVE" as const,
      priority: 10,
      destinationUrl,
      trackingEnabled: true,
      geoScope: "GLOBAL" as const,
      participationId: participation.id,
      startsAt: null,
      endsAt: null,
      archivedAt: null,
    };
    if (campaign) {
      campaign = await prisma.dnxPartnerCampaign.update({
        where: { id: campaign.id },
        data: campaignData,
      });
      reused.campaigns++;
    } else {
      campaign = await prisma.dnxPartnerCampaign.create({
        data: { partnerId: partner.id, name: campaignName, ...campaignData },
      });
      created.campaigns++;
    }
    log(`   campaña   ${plan.application.padEnd(16)} ${campaign.id}`);

    // 3c. Creatividades y vinculación a placements.
    for (const creativePlan of plan.creatives) {
      let creative = await prisma.dnxPartnerCampaignCreative.findFirst({
        where: {
          campaignId: campaign.id,
          format: creativePlan.format,
          deviceTarget: "ALL",
        },
      });
      const creativeData = {
        // Welcome con pieza gráfica propia: se usa la gráfica; el resto, el logo.
        assetId:
          creativePlan.format === "WELCOME_INTERSTITIAL" && creativeAsset
            ? creativeAsset.id
            : asset.id,
        title: creativePlan.title,
        body: creativePlan.body,
        ctaText: creativePlan.ctaText,
        destinationUrl,
        status: "APPROVED" as const,
        sortOrder: 10,
        startsAt: null,
        endsAt: null,
        archivedAt: null,
      };
      if (creative) {
        creative = await prisma.dnxPartnerCampaignCreative.update({
          where: { id: creative.id },
          data: creativeData,
        });
        reused.creatives++;
      } else {
        creative = await prisma.dnxPartnerCampaignCreative.create({
          data: {
            campaignId: campaign.id,
            format: creativePlan.format,
            deviceTarget: "ALL",
            ...creativeData,
          },
        });
        created.creatives++;
      }

      for (const placementKey of creativePlan.placementKeys) {
        const adPlacement = await prisma.dnxPartnerAdPlacement.findUnique({
          where: {
            application_placementKey: {
              application: plan.application,
              placementKey,
            },
          },
        });
        if (!adPlacement) {
          log(`   ⚠ placement ausente en el catálogo: ${placementKey}`);
          continue;
        }
        const binding = await prisma.dnxPartnerCampaignPlacement.upsert({
          where: {
            campaignId_adPlacementId: {
              campaignId: campaign.id,
              adPlacementId: adPlacement.id,
            },
          },
          create: {
            campaignId: campaign.id,
            adPlacementId: adPlacement.id,
            priority: 10,
            isActive: true,
          },
          update: { priority: 10, isActive: true },
        });
        binding.createdAt.getTime() === binding.updatedAt.getTime()
          ? created.bindings++
          : reused.bindings++;
        log(`     ↳ ${creativePlan.format.padEnd(20)} → ${placementKey}`);
      }

      // 3d. Enlace de seguimiento. Sin él el CTA apunta directo al destino;
      //     con él el loader lo reescribe a /r/[clave] y el clic queda registrado.
      const trackingKey = demoTrackingKey(
        brand.slug,
        plan.application,
        creativePlan.trackingPlacement,
      );
      const link = await prisma.dnxPartnerOutboundLink.upsert({
        where: { trackingKey },
        create: {
          trackingKey,
          partnerId: partner.id,
          participationId: participation.id,
          application: plan.application,
          contextType: "GLOBAL",
          placement: creativePlan.trackingPlacement,
          destinationUrl,
          utmSource: "dnx-partners",
          utmMedium: "demo-comercial",
          utmCampaign: brand.slug,
          status: "ACTIVE",
        },
        update: {
          destinationUrl,
          placement: creativePlan.trackingPlacement,
          status: "ACTIVE",
          archivedAt: null,
        },
      });
      link.createdAt.getTime() === link.updatedAt.getTime()
        ? created.links++
        : reused.links++;
      log(`     ↳ tracking  /r/${trackingKey}`);
    }
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  log(`\n=== Seed ${DEMO_PREFIX} DNX Partners ===`);

  // Guardas ANTES de tocar la base.
  const { hostLabel } = assertSafeEnvironment("Seed");
  log(`Destino verificado: ${hostLabel}`);
  log(`NODE_ENV: ${process.env.NODE_ENV ?? "(sin definir)"}`);

  log(`Destino de los enlaces: ${demoDestinationBaseUrl()}?marca=<slug>`);

  const totalPlacements = DEMO_BRANDS.flatMap((b) =>
    b.campaigns.flatMap((c) => c.creatives.flatMap((cr) => cr.placementKeys)),
  );
  const covered = new Set(totalPlacements);
  const missing = EXPECTED_PLACEMENT_KEYS.filter((k) => !covered.has(k));

  log(
    `\nPlan: ${DEMO_BRANDS.length} marcas · ` +
      `${DEMO_BRANDS.reduce((n, b) => n + b.campaigns.length, 0)} campañas · ` +
      `${covered.size} placements distintos`,
  );
  if (missing.length > 0) {
    log(`⚠ Placements montados que este plan NO cubre: ${missing.join(", ")}`);
  } else {
    log(`✓ Cubre los ${EXPECTED_PLACEMENT_KEYS.length} placements montados`);
  }

  if (DRY_RUN) {
    log("\n--dry-run: no se escribió nada. Plan por marca:\n");
    for (const brand of DEMO_BRANDS) {
      log(`▸ ${brand.name}  (${brand.assetFile})`);
      for (const c of brand.campaigns) {
        log(`   ${c.application}`);
        for (const cr of c.creatives) {
          log(`     ${cr.format.padEnd(20)} → ${cr.placementKeys.join(", ")}`);
        }
      }
    }
    return;
  }

  log("\nAsegurando el catálogo de placements…");
  await ensureAdPlacementCatalog(prisma);

  for (const brand of DEMO_BRANDS) {
    await seedBrand(brand);
  }

  log(`\n=== Resumen ===`);
  const rows: Array<[string, number, number]> = [
    ["partners", created.partners, reused.partners],
    ["assets", created.assets, reused.assets],
    ["participaciones", created.participations, reused.participations],
    ["campañas", created.campaigns, reused.campaigns],
    ["creatividades", created.creatives, reused.creatives],
    ["vínculos a placement", created.bindings, reused.bindings],
    ["enlaces de tracking", created.links, reused.links],
  ];
  for (const [label, c, r] of rows) {
    log(`  ${label.padEnd(22)} creados: ${String(c).padStart(3)}   reutilizados: ${String(r).padStart(3)}`);
  }

  log(`\nListo. Para verlo hace falta encender los flags en .env.local de cada app.`);
  log(`Para borrar todo: pnpm --filter clickaton exec tsx scripts/partners-demo-comercial-cleanup.ts`);
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
