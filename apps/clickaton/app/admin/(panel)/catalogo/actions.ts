"use server";

/** Re-export para páginas del panel; implementación en lib/admin-catalog/actions. */
export {
  adjustStockFormAction,
  createProductFormAction,
  createVariantFormAction,
  updateProductFormAction,
  updateVariantFormAction,
} from "@/lib/admin-catalog/actions/product-forms";
