"use server";

import { revalidatePath } from "next/cache";
import { catalogAdminRoutes } from "../design/routes";
import type { ProductFilters, ProductListItem, ProductRecord } from "../domain/types";
import { optionalPesosInputToMinorUnits } from "../ui/money-ui";
import {
  catalogFailure,
  catalogSuccess,
  formString,
  type CatalogActionState,
} from "./action-result";
import { getCatalogService, resolveCatalogActor } from "./runtime";

function revalidateCatalogPaths(productId?: string) {
  const paths = [
    catalogAdminRoutes.hub,
    catalogAdminRoutes.products,
    catalogAdminRoutes.productNew,
    ...(productId ? [catalogAdminRoutes.productDetail(productId)] : []),
  ];
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Fuera de request Next (selfcheck / unit): el caso de uso ya persistió.
    }
  }
}

/** Lista productos (Server Component / action). Requiere actor admin. */
export async function listProductsAction(
  filters: ProductFilters,
): Promise<CatalogActionState<ProductListItem[]>> {
  try {
    const actor = await resolveCatalogActor();
    const data = await getCatalogService().listProducts(actor, filters);
    return catalogSuccess(data);
  } catch (error) {
    return catalogFailure<ProductListItem[]>(error);
  }
}

export async function getProductAction(
  productId: string,
): Promise<CatalogActionState<ProductRecord>> {
  try {
    const actor = await resolveCatalogActor();
    const data = await getCatalogService().getProduct(actor, productId);
    return catalogSuccess(data);
  } catch (error) {
    return catalogFailure<ProductRecord>(error);
  }
}

export async function createProductAction(
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState<ProductRecord>> {
  const editionId = formString(formData, "editionId");
  const name = formString(formData, "name");
  const description = formString(formData, "description");
  const code = formString(formData, "code");
  const values = { editionId, name, description, code, isActive: formString(formData, "isActive") };
  try {
    const actor = await resolveCatalogActor();
    const created = await getCatalogService().createProduct(actor, {
      editionId,
      name,
      description: description || null,
      code,
      isActive: formData.has("isActive"),
    });
    revalidateCatalogPaths(created.id);
    return catalogSuccess(created, "Producto creado.");
  } catch (error) {
    return catalogFailure<ProductRecord>(error, values);
  }
}

export async function updateProductAction(
  productId: string,
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState<ProductRecord>> {
  const name = formString(formData, "name");
  const description = formString(formData, "description");
  const code = formString(formData, "code");
  const values = {
    name,
    description,
    code,
    primaryImageAssetId: formString(formData, "primaryImageAssetId"),
    sizeChartAssetId: formString(formData, "sizeChartAssetId"),
    sizeChartDescription: formString(formData, "sizeChartDescription"),
    sizeChartInstructions: formString(formData, "sizeChartInstructions"),
    storeSlug: formString(formData, "storeSlug"),
    storeTitle: formString(formData, "storeTitle"),
    storeDescription: formString(formData, "storeDescription"),
    storePricePesos: formString(formData, "storePricePesos"),
    compareAtPricePesos: formString(formData, "compareAtPricePesos"),
    storeStatus: formString(formData, "storeStatus"),
  };
  try {
    const actor = await resolveCatalogActor();
    const updated = await getCatalogService().updateProduct(actor, productId, {
      name,
      description: description || null,
      code,
      primaryImageAssetId: formString(formData, "primaryImageAssetId") || null,
      sizeChartAssetId: formString(formData, "sizeChartAssetId") || null,
      sizeChartDescription: formString(formData, "sizeChartDescription") || null,
      sizeChartInstructions: formString(formData, "sizeChartInstructions") || null,
      isStoreEnabled: formData.has("isStoreEnabled"),
      storeStatus: formString(formData, "storeStatus") || "DRAFT",
      storeSlug: formString(formData, "storeSlug") || null,
      storeTitle: formString(formData, "storeTitle") || null,
      storeDescription: formString(formData, "storeDescription") || null,
      storePricePesos: formString(formData, "storePricePesos"),
      compareAtPricePesos: formString(formData, "compareAtPricePesos"),
      requiresShipping: formData.has("requiresShipping"),
      allowPickup: formData.has("allowPickup"),
    });
    revalidateCatalogPaths(productId);
    return catalogSuccess(updated, "Producto actualizado.");
  } catch (error) {
    return catalogFailure<ProductRecord>(error, values);
  }
}

export async function setProductActiveAction(
  productId: string,
  isActive: boolean,
): Promise<CatalogActionState<ProductRecord>> {
  try {
    const actor = await resolveCatalogActor();
    const updated = await getCatalogService().setProductActive(actor, productId, isActive);
    revalidateCatalogPaths(productId);
    return catalogSuccess(
      updated,
      isActive ? "Producto reactivado." : "Producto desactivado.",
    );
  } catch (error) {
    return catalogFailure<ProductRecord>(error);
  }
}

export async function createVariantAction(
  productId: string,
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState> {
  const name = formString(formData, "name");
  const code = formString(formData, "code");
  const sku = formString(formData, "sku");
  const stock = formString(formData, "stock");
  const pricePesos = formString(formData, "pricePesos");
  const currency = formString(formData, "currency");
  const values = { name, code, sku, stock, pricePesos, currency, isActive: formString(formData, "isActive") };
  try {
    const actor = await resolveCatalogActor();
    const priceAmount = optionalPesosInputToMinorUnits(pricePesos || null, "pricePesos");
    const stockParsed = stock === "" ? 0 : Number.parseInt(stock, 10);
    const created = await getCatalogService().createProductVariant(actor, {
      productId,
      name,
      code,
      sku,
      stock: Number.isFinite(stockParsed) ? stockParsed : stock,
      priceAmount,
      currency: priceAmount != null ? currency || "ARS" : null,
      isActive: formData.has("isActive"),
    });
    revalidateCatalogPaths(productId);
    return catalogSuccess(created, "Variante creada.");
  } catch (error) {
    return catalogFailure(error, values);
  }
}

export async function updateVariantAction(
  variantId: string,
  productId: string,
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState> {
  const name = formString(formData, "name");
  const code = formString(formData, "code");
  const sku = formString(formData, "sku");
  const pricePesos = formString(formData, "pricePesos");
  const currency = formString(formData, "currency");
  const values = { name, code, sku, pricePesos, currency, isActive: formString(formData, "isActive") };
  try {
    const actor = await resolveCatalogActor();
    const priceAmount = optionalPesosInputToMinorUnits(pricePesos || null, "pricePesos");
    const updated = await getCatalogService().updateProductVariant(actor, variantId, {
      name,
      code,
      sku,
      priceAmount,
      currency: priceAmount != null ? currency || "ARS" : null,
      isActive: formData.has("isActive"),
    });
    revalidateCatalogPaths(productId);
    return catalogSuccess(updated, "Variante actualizada.");
  } catch (error) {
    return catalogFailure(error, values);
  }
}

export async function setVariantActiveAction(
  variantId: string,
  productId: string,
  isActive: boolean,
): Promise<CatalogActionState> {
  try {
    const actor = await resolveCatalogActor();
    const updated = await getCatalogService().setVariantActive(actor, variantId, isActive);
    revalidateCatalogPaths(productId);
    return catalogSuccess(
      updated,
      isActive ? "Variante reactivada." : "Variante desactivada.",
    );
  } catch (error) {
    return catalogFailure(error);
  }
}

/**
 * Ajuste de stock.
 * Modo `absolute`: campo `newStock` = total deseado.
 * Modo `delta`: campo `delta` = suma/resta (puede ser negativo).
 * Motivo obligatorio.
 */
export async function adjustVariantStockAction(
  variantId: string,
  productId: string,
  _prev: CatalogActionState | undefined,
  formData: FormData,
): Promise<CatalogActionState> {
  const modeRaw = formString(formData, "mode");
  const newStock = formString(formData, "newStock");
  const delta = formString(formData, "delta");
  const reason = formString(formData, "reason");
  const values = { mode: modeRaw, newStock, delta, reason };
  try {
    const actor = await resolveCatalogActor();
    const mode = modeRaw === "delta" ? "delta" : "absolute";
    const updated = await getCatalogService().adjustVariantStock(actor, {
      variantId,
      reason,
      ...(mode === "absolute" ? { newStock } : { delta }),
    });
    revalidateCatalogPaths(productId);
    return catalogSuccess(updated, "Stock ajustado.");
  } catch (error) {
    return catalogFailure(error, values);
  }
}
