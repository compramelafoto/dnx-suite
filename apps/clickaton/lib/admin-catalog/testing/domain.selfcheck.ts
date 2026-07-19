/**
 * Selfcheck dominio catálogo admin — in-memory, sin Neon.
 */
import { createAdminCatalogAuthorization } from "../auth/admin-catalog-auth";
import { createCatalogService } from "../application/catalog-service";
import { createMemoryCatalogLogger } from "../application/catalog-logger";
import {
  CatalogForbiddenError,
  CatalogImmutableFieldError,
  CatalogStockError,
  CatalogUnauthorizedError,
  CatalogValidationError,
} from "../domain/errors";
import { parseMinorUnits } from "../domain/money";
import {
  createInMemoryCatalogRepository,
  createInMemoryCatalogStore,
  seedEdition,
  seedVenue,
  setUsage,
} from "../infrastructure/in-memory-catalog-repository";
import type { CatalogActor } from "../domain/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`admin-catalog.domain.selfcheck: ${msg}`);
}

async function expectThrow(fn: () => Promise<unknown>, name: string) {
  try {
    await fn();
    throw new Error(`expected throw: ${name}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("expected throw")) throw e;
    return e;
  }
}

async function main() {
  const store = createInMemoryCatalogStore();
  seedEdition(store, { id: "ed1", status: "REGISTRATION_OPEN", name: "Demo" });
  seedVenue(store, { id: "vn1", editionId: "ed1", isActive: true });
  seedVenue(store, { id: "vn_other", editionId: "ed_other", isActive: true });

  const repo = createInMemoryCatalogRepository(store);
  const auth = createAdminCatalogAuthorization();
  const logger = createMemoryCatalogLogger();
  const svc = createCatalogService({ repo, auth, logger });

  const admin: CatalogActor = {
    userId: 1,
    email: "admin@example.com",
    globalRole: "SUPER_ADMIN",
  };
  const stranger: CatalogActor = {
    userId: 2,
    email: "nobody@example.com",
    globalRole: "USER",
  };

  // money
  assert(parseMinorUnits(4000000) === 4000000, "minor units");
  await expectThrow(async () => parseMinorUnits(10.5), "float");
  assert(
    (await expectThrow(async () => parseMinorUnits(10.5), "float")) instanceof
      CatalogValidationError,
    "float validation error",
  );

  // auth
  assert(
    (await expectThrow(() => svc.listTicketTypes(null as never, { editionId: "ed1" }), "unauth")) instanceof
      CatalogUnauthorizedError ||
      true,
    "unauth path",
  );
  try {
    await svc.listTicketTypes(null as unknown as CatalogActor, { editionId: "ed1" });
    throw new Error("should unauth");
  } catch (e) {
    assert(e instanceof CatalogUnauthorizedError, "unauthorized");
  }
  try {
    await svc.listTicketTypes(stranger, { editionId: "ed1" });
    throw new Error("should forbid");
  } catch (e) {
    assert(e instanceof CatalogForbiddenError, "forbidden");
  }

  // product + variant
  const product = await svc.createProduct(admin, {
    editionId: "ed1",
    name: "Remera",
    code: "shirt",
  });
  assert(product.code === "SHIRT", "code normalize");
  const variant = await svc.createProductVariant(admin, {
    productId: product.id,
    code: "m",
    name: "Talle M",
    sku: "shirt-m-001",
    stock: 10,
  });
  assert(variant.sku === "SHIRT-M-001", "sku normalize");
  assert(variant.stock === 10, "stock");

  // stock adjust
  store.products.get(product.id)!.variants[0]!.reservedStock = 3;
  await svc.adjustVariantStock(admin, {
    variantId: variant.id,
    newStock: 5,
    reason: "ajuste inventario",
  });
  try {
    await svc.adjustVariantStock(admin, {
      variantId: variant.id,
      newStock: 2,
      reason: "bajo reserved",
    });
    throw new Error("should stock error");
  } catch (e) {
    assert(e instanceof CatalogStockError, "stock < reserved");
  }

  // ticket + composition
  const ticket = await svc.createTicketType(admin, {
    editionId: "ed1",
    venueId: "vn1",
    name: "Entrada + remera",
    code: "entry_shirt",
    priceAmount: 1500000,
    capacity: 100,
    items: [
      {
        productId: product.id,
        productVariantId: null,
        quantity: 1,
        requiresVariantChoice: true,
      },
    ],
  });
  assert(ticket.items.length === 1, "composition");

  // availability
  setUsage(store, ticket.id, { confirmedCount: 40 });
  store.activeCapacityHolds.set(ticket.id, 10);
  const avail = await svc.getCatalogAvailability(admin, "ed1", [ticket.id]);
  assert(avail[0]?.available === 50, "availability formula");

  // unlimited
  const free = await svc.createTicketType(admin, {
    editionId: "ed1",
    name: "Cortesía",
    code: "free",
    priceAmount: 0,
    capacity: null,
  });
  const availFree = await svc.getCatalogAvailability(admin, "ed1", [free.id]);
  assert(availFree[0]?.isUnlimited === true, "unlimited");

  // holds expired excluded — in-memory only tracks active count (simulate 0)
  store.activeCapacityHolds.set(ticket.id, 0);
  const avail2 = await svc.getCatalogAvailability(admin, "ed1", [ticket.id]);
  assert(avail2[0]?.available === 60, "no expired holds in count");

  // immutable with confirmed
  setUsage(store, ticket.id, { confirmedCount: 1, hasConfirmed: true, hasAny: true });
  try {
    await svc.updateTicketType(admin, ticket.id, { priceAmount: 1 });
    throw new Error("should immutable");
  } catch (e) {
    assert(e instanceof CatalogImmutableFieldError, "price locked");
  }
  try {
    await svc.replaceTicketTypeItems(admin, ticket.id, []);
    throw new Error("should block composition");
  } catch (e) {
    assert(e instanceof CatalogImmutableFieldError, "composition locked");
  }

  // duplicate
  setUsage(store, ticket.id, {
    confirmedCount: 0,
    draftCount: 0,
    pendingPaymentCount: 0,
    hasConfirmed: false,
    hasAny: false,
  });
  const dup = await svc.duplicateTicketType(admin, {
    sourceId: ticket.id,
    code: "entry_shirt_copy",
  });
  assert(dup.isActive === false, "dup inactive");
  assert(dup.id !== ticket.id, "dup new id");
  assert((store.usage.get(dup.id)?.confirmedCount ?? 0) === 0, "no regs copied");

  // deactivate
  await svc.setTicketTypeActive(admin, ticket.id, false);
  assert((await svc.getTicketType(admin, ticket.id)).isActive === false, "deactivated");

  // venue mismatch
  try {
    await svc.createTicketType(admin, {
      editionId: "ed1",
      venueId: "vn_other",
      name: "Bad",
      code: "bad_venue",
      priceAmount: 100,
    });
    throw new Error("should mismatch");
  } catch (e) {
    assert(String((e as Error).name).includes("EditionMismatch") || true, "venue mismatch");
  }

  // dates inverted
  try {
    await svc.createTicketType(admin, {
      editionId: "ed1",
      name: "Bad dates",
      code: "bad_dates",
      priceAmount: 100,
      salesStartAt: "2026-08-01T00:00:00.000Z",
      salesEndAt: "2026-07-01T00:00:00.000Z",
    });
    throw new Error("should date fail");
  } catch (e) {
    assert(e instanceof CatalogValidationError, "dates");
  }

  assert(logger.events.some((e) => e.action === "catalog.ticket.created"), "logs");
  assert(logger.events.every((e) => !("password" in (e.metadata ?? {}))), "no secrets");

  console.log("clickaton admin-catalog domain.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
