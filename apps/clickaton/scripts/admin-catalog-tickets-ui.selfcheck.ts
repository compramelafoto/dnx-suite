/**
 * Selfcheck UI entradas/kits 10D3D — in-memory, sin Neon.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminCatalogAuthorization } from "../lib/admin-catalog/auth/admin-catalog-auth";
import { createCatalogService } from "../lib/admin-catalog/application/catalog-service";
import { createMemoryCatalogLogger } from "../lib/admin-catalog/application/catalog-logger";
import {
  createInMemoryCatalogRepository,
  createInMemoryCatalogStore,
  seedEdition,
} from "../lib/admin-catalog/infrastructure/in-memory-catalog-repository";
import type { CatalogActor } from "../lib/admin-catalog/domain/types";
import {
  setCatalogActorForTests,
  setCatalogServiceForTests,
} from "../lib/admin-catalog/actions/runtime";
import {
  addTicketProductAction,
  createTicketTypeAction,
  getTicketTypeAction,
  listTicketTypesAction,
  removeTicketProductAction,
  setTicketTypeActiveAction,
  updateTicketProductAction,
  updateTicketTypeAction,
} from "../lib/admin-catalog/actions/tickets";
import {
  displayTicketPrice,
  pesosInputToMinorUnits,
} from "../lib/admin-catalog/ui/money-ui";
import {
  evaluateTicketConfiguration,
  kitKindOf,
} from "../lib/admin-catalog/ui/ticket-status";
import { catalogAdminRoutes } from "../lib/admin-catalog/design/routes";
import { adminRoutes } from "../config/admin/navigation";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`admin-catalog.tickets-ui.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

async function main() {
  assert(adminRoutes.catalog === "/admin/catalogo", "nav catalog");
  assert(catalogAdminRoutes.tickets === "/admin/catalogo/entradas", "tickets route");
  assert(catalogAdminRoutes.ticketNew.endsWith("/nueva"), "ticket new");

  const hub = file("app/admin/(panel)/catalogo/page.tsx");
  assert(hub.includes("Administrar entradas"), "hub CTA entradas");
  assert(hub.includes("Entradas y kits"), "hub card");
  assert(hub.includes("catalogAdminRoutes.tickets"), "hub link tickets");
  assert(hub.includes("ticketActive") || hub.includes("Activas"), "hub counts");

  for (const rel of [
    "app/admin/(panel)/catalogo/entradas/page.tsx",
    "app/admin/(panel)/catalogo/entradas/nueva/page.tsx",
    "app/admin/(panel)/catalogo/entradas/[ticketTypeId]/page.tsx",
  ]) {
    file(rel);
  }

  const clients = [
    "components/admin/catalog/TicketTypeForm.tsx",
    "components/admin/catalog/TicketCompositionPanel.tsx",
    "components/admin/catalog/TicketActiveToggle.tsx",
  ];
  for (const rel of clients) {
    const src = file(rel);
    assert(src.includes('"use client"'), `${rel} client`);
    assert(!src.includes("@prisma/client"), `${rel} no prisma client`);
    assert(!src.includes("@repo/db"), `${rel} no db`);
    assert(!src.includes("createPrismaCatalogRepository"), `${rel} no prisma repo`);
    assert(!src.includes("createCatalogService"), `${rel} no service`);
    assert(!src.includes("prisma."), `${rel} no prisma.`);
  }

  const actionsSrc = file("lib/admin-catalog/actions/tickets.ts");
  assert(!/hard.?delete|deleteTicketType/i.test(actionsSrc), "no hard delete");
  assert(actionsSrc.includes("replaceTicketTypeItems"), "composition via replace");

  assert(pesosInputToMinorUnits("40000") === 4_000_000, "price convert");
  assert(displayTicketPrice(0) === "Gratis", "gratis");
  assert(displayTicketPrice(4_000_000).includes("40.000"), "ticket price display");

  const store = createInMemoryCatalogStore();
  seedEdition(store, { id: "ed1", status: "REGISTRATION_OPEN", name: "Demo" });
  seedEdition(store, { id: "ed2", status: "DRAFT", name: "Otra" });
  const repo = createInMemoryCatalogRepository(store);
  const svc = createCatalogService({
    repo,
    auth: createAdminCatalogAuthorization(),
    logger: createMemoryCatalogLogger(),
  });
  setCatalogServiceForTests(svc);

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

  setCatalogActorForTests(null);
  const unauth = await createTicketTypeAction(
    undefined,
    form({
      editionId: "ed1",
      name: "X",
      code: "x",
      pricePesos: "1000",
      currency: "ARS",
    }),
  );
  assert(unauth.ok === false && unauth.code === "UNAUTHORIZED", "no session");

  setCatalogActorForTests(stranger);
  const forbidden = await createTicketTypeAction(
    undefined,
    form({
      editionId: "ed1",
      name: "X",
      code: "x",
      pricePesos: "1000",
      currency: "ARS",
    }),
  );
  assert(forbidden.ok === false && forbidden.code === "FORBIDDEN", "no permission");

  setCatalogActorForTests(admin);

  // seed products via service
  const product = await svc.createProduct(admin, {
    editionId: "ed1",
    name: "Remera",
    code: "TEE",
    description: null,
    isActive: true,
  });
  const variant = await svc.createProductVariant(admin, {
    productId: product.id,
    name: "Talle M",
    code: "M",
    sku: "TEE-M",
    stock: 50,
    priceAmount: null,
    currency: null,
    isActive: true,
  });
  const productOtherEd = await svc.createProduct(admin, {
    editionId: "ed2",
    name: "Otro",
    code: "OT",
    description: null,
    isActive: true,
  });

  const created = await createTicketTypeAction(
    undefined,
    form({
      editionId: "ed1",
      name: "General",
      code: "gen",
      description: "Entrada general",
      pricePesos: "40000",
      currency: "ARS",
      capacity: "100",
      holdMinutes: "20",
      salesStartAt: "2026-01-01T10:00",
      salesEndAt: "2026-12-31T23:59",
      isActive: "on",
    }),
  );
  assert(created.ok && created.data?.id, "create ticket");
  assert(created.data!.priceAmount === 4_000_000, "price minor");
  assert(created.data!.capacity === 100, "capacity");
  const ticketId = created.data!.id;

  const listed = await listTicketTypesAction({ editionId: "ed1" });
  assert(listed.ok && listed.data?.length === 1, "list");

  const dup = await createTicketTypeAction(
    undefined,
    form({
      editionId: "ed1",
      name: "Dup",
      code: "GEN",
      pricePesos: "0",
      currency: "ARS",
      isActive: "on",
    }),
  );
  assert(dup.ok === false && dup.code === "DUPLICATE_CODE", "duplicate code");

  const updated = await updateTicketTypeAction(
    ticketId,
    undefined,
    form({
      name: "General Plus",
      code: "gen",
      description: "v2",
      pricePesos: "45000",
      currency: "ARS",
      capacity: "120",
      holdMinutes: "25",
      salesStartAt: "2026-01-01T10:00",
      salesEndAt: "2026-12-31T23:59",
    }),
  );
  assert(updated.ok && updated.data?.name === "General Plus", "update");
  assert(updated.data!.priceAmount === 4_500_000, "update price");

  const off = await setTicketTypeActiveAction(ticketId, false);
  assert(off.ok && off.data?.isActive === false, "deactivate");
  const on = await setTicketTypeActiveAction(ticketId, true);
  assert(on.ok && on.data?.isActive === true, "activate");

  const stockBefore = store.products.get(product.id)!.variants[0]!.stock;

  const added = await addTicketProductAction(
    ticketId,
    undefined,
    form({
      productId: product.id,
      productVariantId: variant.id,
      quantity: "2",
    }),
  );
  assert(added.ok && added.data?.items.length === 1, "add product");
  assert(kitKindOf(added.data!.items) === "entrada_producto", "kit kind");

  const stockAfter = store.products.get(product.id)!.variants[0]!.stock;
  assert(stockAfter === stockBefore, "composition does not change stock");

  const qtyBad = await updateTicketProductAction(
    ticketId,
    product.id,
    undefined,
    form({ quantity: "0", productVariantId: variant.id }),
  );
  assert(qtyBad.ok === false, "invalid quantity");

  const qtyOk = await updateTicketProductAction(
    ticketId,
    product.id,
    undefined,
    form({ quantity: "3", productVariantId: variant.id }),
  );
  assert(qtyOk.ok && qtyOk.data?.items[0]?.quantity === 3, "update quantity");

  const dupItem = await addTicketProductAction(
    ticketId,
    undefined,
    form({
      productId: product.id,
      productVariantId: variant.id,
      quantity: "1",
    }),
  );
  assert(dupItem.ok === false, "duplicate component");

  const badProduct = await addTicketProductAction(
    ticketId,
    undefined,
    form({ productId: "missing", quantity: "1" }),
  );
  assert(badProduct.ok === false, "invalid product");

  const crossEd = await addTicketProductAction(
    ticketId,
    undefined,
    form({ productId: productOtherEd.id, quantity: "1" }),
  );
  assert(
    crossEd.ok === false &&
      (crossEd.code === "EDITION_MISMATCH" || crossEd.code === "VALIDATION"),
    "edition mismatch",
  );

  // already has product — remove then test invalid variant
  const removed = await removeTicketProductAction(ticketId, product.id);
  assert(removed.ok && removed.data?.items.length === 0, "remove product");
  assert(kitKindOf(removed.data!.items) === "entrada", "entrada simple");

  const badVariant2 = await addTicketProductAction(
    ticketId,
    undefined,
    form({
      productId: product.id,
      productVariantId: "nope",
      quantity: "1",
    }),
  );
  assert(badVariant2.ok === false, "invalid variant");

  const kitAgain = await addTicketProductAction(
    ticketId,
    undefined,
    form({
      productId: product.id,
      productVariantId: variant.id,
      quantity: "1",
    }),
  );
  assert(kitAgain.ok, "re-add");

  const got = await getTicketTypeAction(ticketId);
  assert(got.ok && got.data?.items.length === 1, "get ticket");
  const config = evaluateTicketConfiguration(got.data!);
  assert(config.status !== "incomplete", "config ok without requiring many products");

  const free = await createTicketTypeAction(
    undefined,
    form({
      editionId: "ed1",
      name: "Cortesía",
      code: "FREE",
      pricePesos: "0",
      currency: "ARS",
      unlimitedCapacity: "on",
      isActive: "on",
    }),
  );
  assert(free.ok && free.data?.priceAmount === 0 && free.data?.capacity === null, "free unlimited");

  assert(
    typeof unauth.message === "string" &&
      !String(unauth.message).toLowerCase().includes("prisma"),
    "no prisma in error",
  );

  setCatalogServiceForTests(null);
  setCatalogActorForTests(undefined);

  console.log("clickaton admin-catalog tickets-ui.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
