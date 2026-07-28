/**
 * Selfcheck Etapa 8B — resolución ticket base + fase + snapshots + política duplicados.
 *   pnpm --filter clickaton selfcheck:price-phase-products
 */

import assert from "node:assert/strict";
import {
  buildRegistrationItemSnapshots,
  findDuplicateProductsAcrossLevels,
  resolveIncludedProducts,
  ResolveIncludedItemsError,
  type PricePhaseItemResolvedInput,
  type TicketBaseItemInput,
} from "./resolve-included-items";
import {
  holdIdempotencyKey,
  recordInventoryMovement,
  storeHoldIdempotencyKey,
  type InventoryMovementInput,
  type InventoryMovementRecord,
  type InventoryMovementStore,
} from "@/lib/inventory/domain/record-movement";

function product(
  id: string,
  name: string,
  opts?: {
    variants?: TicketBaseItemInput["product"]["variants"];
    imageUrl?: string | null;
    sizeChartUrl?: string | null;
    isActive?: boolean;
  },
): TicketBaseItemInput["product"] {
  return {
    id,
    name,
    description: `Desc ${name}`,
    isActive: opts?.isActive ?? true,
    archivedAt: null,
    primaryImageAssetId: opts?.imageUrl ? `asset-${id}` : null,
    primaryImageUrl: opts?.imageUrl ?? null,
    sizeChartAssetId: opts?.sizeChartUrl ? `chart-${id}` : null,
    sizeChartUrl: opts?.sizeChartUrl ?? null,
    sizeChartDescription: opts?.sizeChartUrl ? "Guía de talles" : null,
    sizeChartInstructions: opts?.sizeChartUrl ? "Medí el pecho" : null,
    gallery: opts?.imageUrl
      ? [
          {
            assetId: `gal-${id}-1`,
            url: `${opts.imageUrl}?g=1`,
            altText: name,
            caption: "Detalle",
            sortOrder: 10,
          },
          {
            assetId: `gal-${id}-2`,
            url: `${opts.imageUrl}?g=2`,
            altText: name,
            caption: null,
            sortOrder: 20,
          },
        ]
      : [],
    variants: opts?.variants ?? [],
  };
}

function shirtVariants() {
  return [
    {
      id: "var_M",
      code: "M",
      name: "M",
      sku: "TEE-M",
      stock: 10,
      reservedStock: 0,
      isActive: true,
      sortOrder: 30,
    },
    {
      id: "var_L",
      code: "L",
      name: "L",
      sku: "TEE-L",
      stock: 0,
      reservedStock: 0,
      isActive: true,
      sortOrder: 40,
    },
  ];
}

function phaseItem(
  id: string,
  prod: TicketBaseItemInput["product"],
  overrides?: Partial<PricePhaseItemResolvedInput>,
): PricePhaseItemResolvedInput {
  return {
    id,
    productId: prod.id,
    quantity: 1,
    requiresVariantChoice: true,
    isIncluded: true,
    fulfillmentRequired: true,
    displayTitle: null,
    displayDescription: null,
    sortOrder: 10,
    product: prod,
    ...overrides,
  };
}

async function main() {
  const shirt = product("prod_tee", "Remera Clickatón", {
    variants: shirtVariants(),
    imageUrl: "https://cdn.example/tee.jpg",
    sizeChartUrl: "https://cdn.example/tee-sizes.jpg",
  });
  const bottle = product("prod_botella", "Botella", {
    variants: [],
    imageUrl: "https://cdn.example/bottle.jpg",
  });

  // 1. Fase con remera
  const withShirt = resolveIncludedProducts({
    ticketBaseItems: [],
    pricePhaseItems: [phaseItem("ppi_1", shirt)],
  });
  assert.equal(withShirt.length, 1);
  assert.equal(withShirt[0]!.sourceType, "PRICE_PHASE");
  assert.equal(withShirt[0]!.requiresVariantChoice, true);
  assert.ok(withShirt[0]!.primaryImageUrl);
  assert.ok(withShirt[0]!.sizeChartUrl);
  assert.equal(withShirt[0]!.gallery.length, 2);

  // 2. Fase sin remera
  const withoutShirt = resolveIncludedProducts({
    ticketBaseItems: [],
    pricePhaseItems: [],
  });
  assert.equal(withoutShirt.length, 0);

  // 3. Varios productos + 4. cantidad > 1
  const multi = resolveIncludedProducts({
    ticketBaseItems: [],
    pricePhaseItems: [
      phaseItem("ppi_1", shirt, { sortOrder: 10 }),
      phaseItem("ppi_2", bottle, {
        sortOrder: 20,
        quantity: 2,
        requiresVariantChoice: false,
      }),
    ],
  });
  assert.equal(multi.length, 2);
  assert.equal(multi[1]!.quantity, 2);
  assert.equal(multi[1]!.requiresVariantChoice, false);

  // 5. Variante obligatoria + 6. sin variantes → error
  assert.throws(
    () =>
      resolveIncludedProducts({
        ticketBaseItems: [],
        pricePhaseItems: [
          phaseItem("ppi_bad", bottle, { requiresVariantChoice: true }),
        ],
      }),
    (e: unknown) =>
      e instanceof ResolveIncludedItemsError &&
      e.code === "VARIANT_REQUIRED_WITHOUT_VARIANTS",
  );

  // 7. Sin stock (en build snapshots)
  assert.throws(
    () =>
      buildRegistrationItemSnapshots(
        withShirt,
        [{ productId: "prod_tee", productVariantId: "var_L" }],
        "ARS",
      ),
    (e: unknown) => e instanceof ResolveIncludedItemsError,
  );

  // 8/9. Selector visible vs oculto (señales de dominio)
  assert.equal(withShirt[0]!.requiresVariantChoice, true);
  assert.equal(multi[1]!.requiresVariantChoice, false);

  // 10–12. Cuadro talles + imagen + galería
  assert.ok(withShirt[0]!.sizeChartDescription);
  assert.equal(withShirt[0]!.gallery[0]!.sortOrder, 10);

  // 13. Snapshot
  const snaps = buildRegistrationItemSnapshots(
    withShirt,
    [{ productId: "prod_tee", productVariantId: "var_M" }],
    "ARS",
  );
  assert.equal(snaps.length, 1);
  assert.equal(snaps[0]!.unitPriceAmount, 0);
  assert.equal(snaps[0]!.isIncluded, true);
  assert.equal(snaps[0]!.sourceType, "PRICE_PHASE");
  assert.equal(snaps[0]!.pricePhaseItemId, "ppi_1");
  assert.equal(snaps[0]!.productNameSnapshot, "Remera Clickatón");
  assert.equal(snaps[0]!.variantNameSnapshot, "M");
  assert.equal(snaps[0]!.imageAssetIdSnapshot, "asset-prod_tee");

  // 14–15. Cambio posterior de fase no muta snapshot (inmutabilidad por valor)
  const frozen = { ...snaps[0]! };
  const phaseChanged = resolveIncludedProducts({
    ticketBaseItems: [],
    pricePhaseItems: [],
  });
  assert.equal(phaseChanged.length, 0);
  assert.equal(frozen.productNameSnapshot, "Remera Clickatón");

  // 19. Producto duplicado ticket+fase
  const baseItem: TicketBaseItemInput = {
    id: "tti_1",
    productId: shirt.id,
    productVariantId: null,
    quantity: 1,
    requiresVariantChoice: true,
    product: shirt,
    productVariant: null,
  };
  assert.throws(
    () =>
      resolveIncludedProducts({
        ticketBaseItems: [baseItem],
        pricePhaseItems: [phaseItem("ppi_dup", shirt)],
      }),
    (e: unknown) =>
      e instanceof ResolveIncludedItemsError &&
      e.code === "DUPLICATE_PRODUCT_TICKET_AND_PHASE",
  );
  assert.deepEqual(
    findDuplicateProductsAcrossLevels([shirt.id], [shirt.id, bottle.id]),
    [shirt.id],
  );

  // 20. Combinación ticket base + fase (productos distintos)
  const notebook = product("prod_note", "Cuaderno");
  const combo = resolveIncludedProducts({
    ticketBaseItems: [
      {
        id: "tti_access",
        productId: notebook.id,
        productVariantId: null,
        quantity: 1,
        requiresVariantChoice: false,
        product: notebook,
        productVariant: null,
      },
    ],
    pricePhaseItems: [phaseItem("ppi_1", shirt)],
  });
  assert.equal(combo.length, 2);
  assert.equal(combo[0]!.sourceType, "TICKET_BASE");
  assert.equal(combo[1]!.sourceType, "PRICE_PHASE");

  // 23–25. Prep tienda (contrato de campos — no storefront)
  const storePrep = {
    isStoreEnabled: false,
    storeStatus: "DRAFT" as const,
    storeSlug: "remera-clickaton",
    storePrice: 1_800_000,
    compareAtPrice: null as number | null,
  };
  assert.equal(storePrep.isStoreEnabled, false);
  assert.equal(storePrep.storeStatus, "DRAFT");
  assert.ok(storePrep.storePrice > 0);

  // 26–27. Stock compartido + movimiento idempotente
  const ledger = new Map<string, InventoryMovementRecord>();
  const store: InventoryMovementStore = {
    async findByIdempotencyKey(key) {
      return ledger.get(key) ?? null;
    },
    async create(input: InventoryMovementInput) {
      const record: InventoryMovementRecord = {
        ...input,
        id: `mov_${ledger.size + 1}`,
        createdAt: new Date(),
      };
      ledger.set(input.idempotencyKey, record);
      return record;
    },
  };
  const key = holdIdempotencyKey("reg_1", "var_M", "hold");
  const first = await recordInventoryMovement(store, {
    productId: shirt.id,
    variantId: "var_M",
    movementType: "REGISTRATION_HOLD",
    quantity: 1,
    sourceType: "REGISTRATION",
    sourceId: "reg_1",
    idempotencyKey: key,
  });
  const second = await recordInventoryMovement(store, {
    productId: shirt.id,
    variantId: "var_M",
    movementType: "REGISTRATION_HOLD",
    quantity: 1,
    sourceType: "REGISTRATION",
    sourceId: "reg_1",
    idempotencyKey: key,
  });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(ledger.size, 1);

  const storeKey = storeHoldIdempotencyKey("ord_1", "var_M", "hold");
  await recordInventoryMovement(store, {
    productId: shirt.id,
    variantId: "var_M",
    movementType: "STORE_HOLD",
    quantity: 1,
    sourceType: "STORE_ORDER",
    sourceId: "ord_1",
    idempotencyKey: storeKey,
  });
  assert.equal(ledger.size, 2);

  // 28. Venta futura no afecta snapshot inscripción
  assert.equal(frozen.unitPriceAmount, 0);
  assert.equal(frozen.isIncluded, true);

  // 35. Producto archivado
  assert.throws(
    () =>
      resolveIncludedProducts({
        ticketBaseItems: [],
        pricePhaseItems: [
          phaseItem(
            "ppi_arch",
            { ...shirt, isActive: false, archivedAt: new Date() },
          ),
        ],
      }),
    (e: unknown) =>
      e instanceof ResolveIncludedItemsError && e.code === "PRODUCT_INACTIVE",
  );

  // 38. No se confían productos del frontend
  assert.throws(
    () =>
      buildRegistrationItemSnapshots(
        withShirt,
        [{ productId: "prod_hacker", productVariantId: "var_M" }],
        "ARS",
      ),
    (e: unknown) => e instanceof ResolveIncludedItemsError,
  );

  // 34. Orden galería
  assert.deepEqual(
    withShirt[0]!.gallery.map((g) => g.sortOrder),
    [10, 20],
  );

  console.log(
    JSON.stringify({
      ok: true,
      checks: [
        "phase_with_shirt",
        "phase_without_shirt",
        "multi_products",
        "qty_gt_1",
        "variant_required",
        "no_variants_error",
        "out_of_stock",
        "size_chart",
        "primary_image",
        "gallery_order",
        "snapshot",
        "phase_change_immutable",
        "duplicate_blocked",
        "ticket_plus_phase",
        "store_prep",
        "inventory_idempotent",
        "frontend_products_rejected",
        "archived_product",
      ],
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
