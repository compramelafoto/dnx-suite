import { PrismaClient, UpsellStrategyStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed estrategias de upsell MVP...");

  const strategies = [
    {
      slug: "PACK_DIGITAL_ADD_MORE",
      name: "Agregar más fotos al pack digital",
      description: "Upsell para que el cliente agregue más fotos a su compra digital.",
      status: UpsellStrategyStatus.BETA,
      enabledGlobally: true,
      requiresCapabilities: ["DIGITAL_SALES"],
      requiresConfigKeys: [] as string[],
      rulesJson: {},
      rolloutPercent: 100,
      rolloutAllowlist: [] as string[],
    },
    {
      slug: "STORAGE_EXTEND",
      name: "Extender almacenamiento del álbum",
      description: "Ofrecer extensión del tiempo de disponibilidad del álbum.",
      status: UpsellStrategyStatus.BETA,
      enabledGlobally: true,
      requiresCapabilities: ["STORAGE_EXTEND"],
      requiresConfigKeys: ["storageExtendPricing"],
      rulesJson: {},
      rolloutPercent: 100,
      rolloutAllowlist: [] as string[],
    },
    {
      slug: "RETOUCH_PRO",
      name: "Retoque profesional",
      description: "Ofrecer retoque profesional en fotos seleccionadas.",
      status: UpsellStrategyStatus.BETA,
      enabledGlobally: true,
      requiresCapabilities: ["RETOUCH_PRO"],
      requiresConfigKeys: ["retouchPricing"],
      rulesJson: {},
      rolloutPercent: 100,
      rolloutAllowlist: [] as string[],
    },
    {
      slug: "PRINTS",
      name: "Impresiones",
      description: "Upsell de impresiones (requiere lista de precios y fulfillment).",
      status: UpsellStrategyStatus.BETA,
      enabledGlobally: true,
      requiresCapabilities: ["PRINT_SALES"],
      requiresConfigKeys: ["printsPriceList", "printsFulfillment"],
      rulesJson: {},
      rolloutPercent: 100,
      rolloutAllowlist: [] as string[],
    },
    {
      slug: "EXPRESS_DELIVERY",
      name: "Entrega express",
      description: "Opción de entrega express.",
      status: UpsellStrategyStatus.BETA,
      enabledGlobally: true,
      requiresCapabilities: ["EXPRESS_DELIVERY"],
      requiresConfigKeys: ["expressPricing"],
      rulesJson: {},
      rolloutPercent: 100,
      rolloutAllowlist: [] as string[],
    },
  ];

  for (const s of strategies) {
    await prisma.upsellStrategy.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        description: s.description,
        status: s.status,
        enabledGlobally: s.enabledGlobally,
        requiresCapabilities: s.requiresCapabilities,
        requiresConfigKeys: s.requiresConfigKeys,
        rulesJson: s.rulesJson as any,
        rolloutPercent: s.rolloutPercent,
        rolloutAllowlist: s.rolloutAllowlist,
      },
      create: {
        slug: s.slug,
        name: s.name,
        description: s.description,
        status: s.status,
        enabledGlobally: s.enabledGlobally,
        requiresCapabilities: s.requiresCapabilities,
        requiresConfigKeys: s.requiresConfigKeys,
        rulesJson: s.rulesJson as any,
        rolloutPercent: s.rolloutPercent,
        rolloutAllowlist: s.rolloutAllowlist,
      },
    });
    console.log("  ✅", s.slug);
  }

  console.log("\n✨ Seed de estrategias de upsell completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
