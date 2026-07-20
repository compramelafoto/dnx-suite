/**
 * Selfcheck Prisma catálogo — PostgreSQL local descartable (nunca Neon / DB fija).
 */
import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { join } from "node:path";
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
  if (
    host.includes("neon.tech") ||
    host.includes("ep-dawn-dew") ||
    host.includes("amazonaws.com")
  ) {
    console.error(`ABORT: host=${sanitizeHost(url)} — Neon/remoto bloqueado.`);
    process.exit(2);
  }
  if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
    console.error(`ABORT: host=${sanitizeHost(url)} — solo localhost.`);
    process.exit(2);
  }
}

function findFreeLocalPgPort(): number {
  for (const port of [5432, 5433, 55432, 55434]) {
    try {
      execSync(`pg_isready -h 127.0.0.1 -p ${port}`, { stdio: "ignore" });
      return port;
    } catch {
      /* next */
    }
  }
  throw new Error("No hay PostgreSQL local (pg_isready).");
}

function createDisposableDb(): { url: string; dbName: string; port: number; drop: () => void } {
  const port = findFreeLocalPgPort();
  const user = userInfo().username || "postgres";
  const dbName = `clickaton_catalog_${randomBytes(4).toString("hex")}`;
  if (dbName === "clickaton_10d3fb_tmp" || dbName.includes("10d3fb_tmp")) {
    throw new Error("refused fixed clickaton_10d3fb_tmp");
  }
  const url = `postgresql://${user}@127.0.0.1:${port}/${dbName}?schema=public`;
  assertLocalDatabaseUrl(url);
  execSync(`createdb -h 127.0.0.1 -p ${port} ${dbName}`, { stdio: "ignore" });
  const drop = () => {
    try {
      execSync(`dropdb -h 127.0.0.1 -p ${port} --if-exists ${dbName}`, { stdio: "ignore" });
    } catch {
      /* best effort */
    }
  };
  return { url, dbName, port, drop };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`admin-catalog.prisma.selfcheck: ${msg}`);
}

function readOptionalEnv(name: string): string | undefined {
  // Lectura dinámica para no declarar env vars en turbo.json del selfcheck local.
  return (process.env as Record<string, string | undefined>)[name];
}

async function main() {
  const overrideUrl = readOptionalEnv("CLICKATON_CATALOG_TEST_DATABASE_URL");
  let drop: (() => void) | null = null;
  let url: string;
  let portNote: string;

  if (overrideUrl) {
    assertLocalDatabaseUrl(overrideUrl);
    url = overrideUrl;
    portNote = `override host=${sanitizeHost(overrideUrl)}`;
  } else {
    const disposable = createDisposableDb();
    url = disposable.url;
    drop = disposable.drop;
    portNote = `127.0.0.1:${disposable.port} db=${disposable.dbName}`;
  }

  // Forzar URL local antes de importar el singleton Prisma.
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  const g = globalThis as unknown as { prisma?: { $disconnect?: () => Promise<void> } };
  if (g.prisma?.$disconnect) {
    await g.prisma.$disconnect().catch(() => undefined);
  }
  g.prisma = undefined;

  console.log(`prisma_selfcheck_host=${sanitizeHost(url)} (${portNote})`);
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  try {
    execSync("pnpm --filter @repo/db exec prisma migrate deploy", {
      cwd: join(process.cwd(), "../.."),
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });

    const { prisma } = await import("@/lib/admin/db");
    const { createAdminCatalogAuthorization } = await import("../auth/admin-catalog-auth");
    const { createCatalogService } = await import("../application/catalog-service");
    const { createMemoryCatalogLogger } = await import("../application/catalog-logger");
    const { createPrismaCatalogRepository } = await import(
      "../infrastructure/prisma-catalog-repository"
    );

    try {
      await prisma.clickatonEdition.findFirst({ take: 1 });
    } catch (err) {
      console.error(
        "Tablas Clickaton ausentes tras migrate deploy.",
        err instanceof Error ? err.message : err,
      );
      process.exit(2);
    }

    const suffix = randomBytes(3).toString("hex");
    const editionId = `ed_10d3h_${suffix}`;
    const venueId = `vn_10d3h_${suffix}`;
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

      const stillThere = await prisma.clickatonProduct.findUnique({
        where: { id: product.id },
      });
      assert(stillThere != null, "no hard delete");

      const hash = createHash("sha256").update(editionId).digest("hex").slice(0, 8);
      console.log(`clickaton admin-catalog prisma.selfcheck: ok fixture=${hash}`);
    } finally {
      await cleanup();
      await prisma.$disconnect();
    }
  } finally {
    drop?.();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
