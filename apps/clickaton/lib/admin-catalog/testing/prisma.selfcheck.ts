/**
 * Selfcheck Prisma catálogo — SOLO Postgres local descartable.
 * Abort si la URL apunta a Neon.
 */
import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { userInfo } from "node:os";

function sanitizeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}

function assertLocalDatabaseUrl(url: string): void {
  const host = sanitizeHost(url).toLowerCase();
  if (host.includes("neon.tech") || host.includes("ep-dawn-dew") || host.includes("amazonaws.com")) {
    console.error(`ABORT: host=${sanitizeHost(url)} — Neon/remoto bloqueado para selfcheck Prisma.`);
    process.exit(2);
  }
  if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
    console.error(`ABORT: host=${sanitizeHost(url)} — solo localhost permitido.`);
    process.exit(2);
  }
}

function readOptionalEnv(name: string): string | undefined {
  // Lectura dinámica para no declarar env vars en turbo.json del selfcheck local.
  return (process.env as Record<string, string | undefined>)[name];
}

function ensureLocalDb(dbName: string): string {
  const user = userInfo().username || "postgres";
  const url = `postgresql://${user}@127.0.0.1:55434/${dbName}?schema=public`;
  assertLocalDatabaseUrl(url);
  try {
    execSync(`createdb -h 127.0.0.1 -p 55434 ${dbName}`, { stdio: "ignore" });
  } catch {
    // exists
  }
  return url;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`admin-catalog.prisma.selfcheck: ${msg}`);
}

async function main() {
  const dbName = readOptionalEnv("CLICKATON_CATALOG_TEST_DB") || "10d3b_catalog";
  const url = readOptionalEnv("CLICKATON_CATALOG_TEST_DATABASE_URL") || ensureLocalDb(dbName);
  assertLocalDatabaseUrl(url);
  console.log(`prisma_selfcheck_host=${sanitizeHost(url)}`);

  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  // Avoid loading packages/db/.env Neon via prisma package side effects — URL already set.

  const { prisma } = await import("@/lib/admin/db");
  const { createAdminCatalogAuthorization } = await import("../auth/admin-catalog-auth");
  const { createCatalogService } = await import("../application/catalog-service");
  const { createMemoryCatalogLogger } = await import("../application/catalog-logger");
  const { createPrismaCatalogRepository } = await import(
    "../infrastructure/prisma-catalog-repository"
  );

  // Ensure schema present (reuse migrate deploy from packages/db if empty)
  try {
    await prisma.clickatonEdition.findFirst({ take: 1 });
  } catch {
    console.error(
      "Tablas Clickaton ausentes. Aplicá migraciones en la base local (cadena existente) y reintentá.",
    );
    process.exit(2);
  }

  const suffix = randomBytes(3).toString("hex");
  const editionId = `ed_10d3b_${suffix}`;
  const venueId = `vn_10d3b_${suffix}`;
  const admin = {
    userId: 1,
    email: "admin@example.com",
    globalRole: "SUPER_ADMIN" as const,
  };

  const repo = createPrismaCatalogRepository();
  const svc = createCatalogService({
    repo,
    auth: createAdminCatalogAuthorization(),
    logger: createMemoryCatalogLogger(),
  });

  // cleanup helper
  const cleanup = async () => {
    await prisma.clickatonTicketTypeItem.deleteMany({
      where: { ticketType: { editionId } },
    });
    await prisma.clickatonTicketType.deleteMany({ where: { editionId } });
    await prisma.clickatonProductVariant.deleteMany({
      where: { product: { editionId } },
    });
    await prisma.clickatonProduct.deleteMany({ where: { editionId } });
    await prisma.clickatonVenue.deleteMany({ where: { id: venueId } });
    await prisma.clickatonEdition.deleteMany({ where: { id: editionId } });
  };

  try {
    await cleanup();
    await prisma.clickatonEdition.create({
      data: {
        id: editionId,
        name: "Catalog Test",
        slug: `catalog-test-${suffix}`,
        status: "REGISTRATION_OPEN",
      },
    });
    await prisma.clickatonVenue.create({
      data: {
        id: venueId,
        editionId,
        name: "Sede Test",
        slug: `sede-${suffix}`,
        city: "CABA",
        country: "AR",
      },
    });

    const product = await svc.createProduct(admin, {
      editionId,
      name: "Botella",
      code: `BOT_${suffix}`,
    });
    const variant = await svc.createProductVariant(admin, {
      productId: product.id,
      code: "STD",
      name: "Estándar",
      sku: `BOT-STD-${suffix}`,
      stock: 20,
    });

    await prisma.clickatonProductVariant.update({
      where: { id: variant.id },
      data: { reservedStock: 5 },
    });

    const adjusted = await svc.adjustVariantStock(admin, {
      variantId: variant.id,
      newStock: 10,
      reason: "selfcheck",
    });
    assert(adjusted.stock === 10, "stock adjusted");

    let stockBlocked = false;
    try {
      await svc.adjustVariantStock(admin, {
        variantId: variant.id,
        newStock: 1,
        reason: "too low",
      });
    } catch {
      stockBlocked = true;
    }
    assert(stockBlocked, "stock < reserved blocked");

    const ticket = await svc.createTicketType(admin, {
      editionId,
      venueId,
      name: "Entrada test",
      code: `T_${suffix}`,
      priceAmount: 10000,
      capacity: 50,
      items: [
        {
          productId: product.id,
          productVariantId: variant.id,
          quantity: 1,
          requiresVariantChoice: false,
        },
      ],
    });
    assert(ticket.items.length === 1, "items");

    const listed = await svc.listTicketTypes(admin, { editionId, isActive: true });
    assert(listed.some((t) => t.id === ticket.id), "list");

    const avail = await svc.getCatalogAvailability(admin, editionId, [ticket.id]);
    assert(avail[0]?.available === 50, "avail empty");
    assert(avail[0]?.isSoldOut === false, "not sold out");

    const dup = await svc.duplicateTicketType(admin, {
      sourceId: ticket.id,
      code: `T_${suffix}_C`,
    });
    assert(dup.isActive === false, "dup inactive");

    await svc.setProductActive(admin, product.id, false);
    assert((await svc.getProduct(admin, product.id)).isActive === false, "product soft");

    // no hard delete API — tables still queryable
    const stillThere = await prisma.clickatonProduct.findUnique({ where: { id: product.id } });
    assert(stillThere != null, "no hard delete");

    const hash = createHash("sha256").update(editionId).digest("hex").slice(0, 8);
    console.log(`clickaton admin-catalog prisma.selfcheck: ok fixture=${hash}`);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
