"use server";

import { redirect } from "next/navigation";
import { catalogAdminRoutes } from "../design/routes";
import type { CatalogActionState } from "./action-result";
import {
  adjustVariantStockAction,
  createProductAction,
  createVariantAction,
  updateProductAction,
  updateVariantAction,
} from "./products";

export async function createProductFormAction(
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await createProductAction(prev, formData);
  if (result.ok && result.data && typeof result.data === "object" && "id" in result.data) {
    redirect(
      `${catalogAdminRoutes.productDetail(String(result.data.id))}?flash=product_created`,
    );
  }
  return result;
}

export async function updateProductFormAction(
  productId: string,
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await updateProductAction(productId, prev, formData);
  if (result.ok) {
    redirect(`${catalogAdminRoutes.productDetail(productId)}?flash=product_updated`);
  }
  return result;
}

export async function createVariantFormAction(
  productId: string,
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await createVariantAction(productId, prev, formData);
  if (result.ok) {
    redirect(`${catalogAdminRoutes.productDetail(productId)}?flash=variant_created`);
  }
  return result;
}

export async function updateVariantFormAction(
  variantId: string,
  productId: string,
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await updateVariantAction(variantId, productId, prev, formData);
  if (result.ok) {
    redirect(`${catalogAdminRoutes.productDetail(productId)}?flash=variant_updated`);
  }
  return result;
}

export async function adjustStockFormAction(
  variantId: string,
  productId: string,
  prev: CatalogActionState | undefined,
  formData: FormData,
) {
  const result = await adjustVariantStockAction(variantId, productId, prev, formData);
  if (result.ok) {
    redirect(`${catalogAdminRoutes.productDetail(productId)}?flash=stock_adjusted`);
  }
  return result;
}
