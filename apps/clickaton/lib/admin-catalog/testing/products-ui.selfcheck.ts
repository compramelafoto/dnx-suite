/**
 * Selfcheck UI productos/variantes 10D3C — in-memory, sin Neon.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createAdminCatalogAuthorization } from "../auth/admin-catalog-auth";
import { createCatalogService } from "../application/catalog-service";
import { createMemoryCatalogLogger } from "../application/catalog-logger";
import {
  createInMemoryCatalogRepository,
  createInMemoryCatalogStore,
  seedEdition,
} from "../infrastructure/in-memory-catalog-repository";
import type { CatalogActor } from "../domain/types";
import {
  setCatalogActorForTests,
  setCatalogServiceForTests,
} from "../actions/runtime";
import {
  adjustVariantStockAction,
  createProductAction,
  createVariantAction,
  getProductAction,
  listProductsAction,
  setProductActiveAction,
  setVariantActiveAction,
  updateProductAction,
  updateVariantAction,
} from "../actions/products";
import {
  displayPrice,
  optionalPesosInputToMinorUnits,
  pesosInputToMinorUnits,
} from "../ui/money-ui";
import { catalogAdminRoutes } from "../design/routes";
import { adminRoutes } from "@/config/admin/navigation";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`admin-catalog.products-ui.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing file ${rel}`);
  return readFileSync(p, "utf8");
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

async function main() {
  // --- rutas / nav / páginas ---
  assert(adminRoutes.catalog === "/admin/catalogo", "nav catalog route");
  assert(catalogAdminRoutes.hub === "/admin/catalogo", "hub route");
  assert(catalogAdminRoutes.products === "/admin/catalogo/productos", "products route");
  assert(catalogAdminRoutes.productNew === "/admin/catalogo/productos/nuevo", "new route");

  const hub = file("app/admin/(panel)/catalogo/page.tsx");
  assert(hub.includes("Administrar productos"), "hub CTA");
  assert(hub.includes("Próximamente"), "hub soon");
  assert(!hub.includes('href="/admin/catalogo/entradas"'), "no broken entradas link");

  const listPage = file("app/admin/(panel)/catalogo/productos/page.tsx");
  assert(listPage.includes("Crear primer producto"), "empty CTA");
  assert(listPage.includes("listProductsAction"), "list uses action");

  const newPage = file("app/admin/(panel)/catalogo/productos/nuevo/page.tsx");
  assert(newPage.includes("createProductFormAction"), "create form action");

  const detailPage = file("app/admin/(panel)/catalogo/productos/[productId]/page.tsx");
  assert(detailPage.includes("ProductVariantsPanel"), "variants panel");
  assert(detailPage.includes("ProductActiveToggle"), "activate toggle");

  const nav = file("config/admin/navigation.ts");
  assert(nav.includes('label: "Catálogo"'), "nav label");

  // client components: no Prisma
  const clients = [
    "components/admin/catalog/ProductForm.tsx",
    "components/admin/catalog/VariantForm.tsx",
    "components/admin/catalog/StockAdjustForm.tsx",
    "components/admin/catalog/ProductVariantsPanel.tsx",
    "components/admin/catalog/ProductActiveToggle.tsx",
    "components/admin/catalog/ProductListActiveButton.tsx",
  ];
  for (const rel of clients) {
    const src = file(rel);
    assert(!src.includes("@repo/db"), `${rel} no db`);
    assert(!src.includes("from \"@prisma"), `${rel} no prisma`);
    assert(!src.includes("createPrismaCatalogRepository"), `${rel} no prisma repo`);
    assert(!src.includes("prisma."), `${rel} no prisma client`);
  }

  // no hard delete in products actions
  const actionsSrc = file("lib/admin-catalog/actions/products.ts");
  assert(!/hard.?delete|deleteProduct|deleteVariant/i.test(actionsSrc), "no hard delete");
  assert(actionsSrc.includes("revalidatePath"), "revalidate");

  // money UI
  assert(pesosInputToMinorUnits("40000") === 4_000_000, "pesos→minor");
  assert(pesosInputToMinorUnits("40.000") === 4_000_000, "pesos miles");
  assert(optionalPesosInputToMinorUnits("") === null, "empty price");
  assert(displayPrice(null) === "Sin precio adicional", "null price label");
  assert(displayPrice(0) === "Incluido / sin adicional", "zero price");
  assert(displayPrice(4_000_000).includes("40.000"), "display format");
  assert(displayPrice(4_000_000).includes("ARS"), "display currency");

  // --- actions against in-memory ---
  const store = createInMemoryCatalogStore();
  seedEdition(store, { id: "ed1", status: "REGISTRATION_OPEN", name: "Demo" });
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
  const unauth = await createProductAction(undefined, form({
    editionId: "ed1",
    name: "X",
    code: "x",
    description: "",
  }));
  assert(unauth.ok === false && unauth.code === "UNAUTHORIZED", "no session");

  setCatalogActorForTests(stranger);
  const forbidden = await createProductAction(undefined, form({
    editionId: "ed1",
    name: "X",
    code: "x",
    description: "",
  }));
  assert(forbidden.ok === false && forbidden.code === "FORBIDDEN", "no permission");

  setCatalogActorForTests(admin);
  const created = await createProductAction(
    undefined,
    form({
      editionId: "ed1",
      name: "Remera",
      code: "tee",
      description: "Algodón",
      isActive: "on",
    }),
  );
  assert(created.ok && created.data?.id, "create product");
  const productId = created.data!.id;

  const dup = await createProductAction(
    undefined,
    form({
      editionId: "ed1",
      name: "Otra",
      code: "TEE",
      description: "",
      isActive: "on",
    }),
  );
  assert(dup.ok === false && dup.code === "DUPLICATE_CODE", "duplicate code");

  const listed = await listProductsAction({ editionId: "ed1" });
  assert(listed.ok && listed.data?.length === 1, "list products");

  const updated = await updateProductAction(
    productId,
    undefined,
    form({ name: "Remera oficial", code: "tee", description: "v2" }),
  );
  assert(updated.ok && updated.data?.name === "Remera oficial", "update product");

  const deactivated = await setProductActiveAction(productId, false);
  assert(deactivated.ok && deactivated.data?.isActive === false, "deactivate");
  const reactivated = await setProductActiveAction(productId, true);
  assert(reactivated.ok && reactivated.data?.isActive === true, "reactivate");

  const variant = await createVariantAction(
    productId,
    undefined,
    form({
      name: "Talle M",
      code: "m",
      sku: "TEE-M",
      stock: "10",
      pricePesos: "40000",
      currency: "ARS",
      isActive: "on",
    }),
  );
  assert(variant.ok, "create variant");
  const variantId = (variant.data as { id: string }).id;
  const got = await getProductAction(productId);
  assert(got.ok && got.data?.variants[0]?.priceAmount === 4_000_000, "price conversion");

  const dupSku = await createVariantAction(
    productId,
    undefined,
    form({
      name: "Talle L",
      code: "l",
      sku: "tee-m",
      stock: "1",
      pricePesos: "",
      currency: "ARS",
      isActive: "on",
    }),
  );
  assert(dupSku.ok === false && dupSku.code === "DUPLICATE_SKU", "duplicate sku");

  // reserved then bad stock
  const product = store.products.get(productId)!;
  const vr = product.variants.find((x) => x.id === variantId)!;
  vr.reservedStock = 8;

  const badStock = await adjustVariantStockAction(
    variantId,
    productId,
    undefined,
    form({ mode: "absolute", newStock: "5", reason: "test" }),
  );
  assert(badStock.ok === false && badStock.code === "STOCK", "stock < reserved");

  const okStock = await adjustVariantStockAction(
    variantId,
    productId,
    undefined,
    form({ mode: "absolute", newStock: "12", reason: "ingreso" }),
  );
  assert(okStock.ok, "stock adjust");

  const vUp = await updateVariantAction(
    variantId,
    productId,
    undefined,
    form({
      name: "Talle M+",
      code: "m",
      sku: "TEE-M",
      pricePesos: "",
      currency: "ARS",
      isActive: "on",
    }),
  );
  assert(vUp.ok, "update variant");

  const vOff = await setVariantActiveAction(variantId, productId, false);
  assert(vOff.ok, "deactivate variant");

  // serializable error shape
  assert(
    typeof unauth.message === "string" && !String(unauth.message).toLowerCase().includes("prisma"),
    "no prisma in error",
  );

  setCatalogServiceForTests(null);
  setCatalogActorForTests(undefined);

  console.log("clickaton admin-catalog products-ui.selfcheck: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
