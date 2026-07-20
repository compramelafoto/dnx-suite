"use server";

/** Re-export para páginas del panel. */
export {
  adjustStockFormAction,
  createProductFormAction,
  createVariantFormAction,
  updateProductFormAction,
  updateVariantFormAction,
} from "@/lib/admin-catalog/actions/product-forms";

export {
  addTicketProductFormAction,
  createTicketTypeFormAction,
  updateTicketProductFormAction,
  updateTicketTypeFormAction,
} from "@/lib/admin-catalog/actions/ticket-forms";
