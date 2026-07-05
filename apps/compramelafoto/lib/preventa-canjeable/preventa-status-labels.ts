/** Etiquetas humanas para enums operativos de preventa escolar (UI fotógrafo/cliente). */

const PRECOMPRA_ORDER_ITEM_STATUS: Record<string, string> = {
  WAITING_SELFIE: "Esperando selfie",
  WAITING_UPLOAD: "Esperando fotos del fotógrafo",
  APPROVED_BY_MATCH: "Fotos identificadas",
  WAITING_SELECTION: "Familia eligiendo fotos",
  READY_TO_DESIGN: "Listo para diseñar",
  DESIGN_SUBMITTED: "Diseño en revisión",
  NEEDS_CHANGES: "Diseño con cambios",
  APPROVED: "Diseño aprobado",
  EXPORTED: "Listo para impresión",
  PHYSICAL_IN_PROGRESS: "En producción",
  AT_SCHOOL: "En la escuela",
  DELIVERED: "Entregado",
};

const PRECOMPRA_ORDER_STATUS: Record<string, string> = {
  CREATED: "Pendiente de pago",
  PAID_HELD: "Pagado",
  CANCELED: "Cancelado",
};

const DESIGN_PROJECT_STATUS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_PHOTOS: "Esperando fotos",
  PENDING_SELECTION: "Esperando selección",
  READY: "Listo para diseñar",
  IN_REVIEW: "En revisión",
  NEEDS_CHANGES: "Con cambios pedidos",
  APPROVED: "Aprobado",
  APPROVED_FOR_EXPORT: "Aprobado para exportar",
  EXPORTING: "Exportando",
  EXPORTED: "Exportado",
  FAILED: "Error",
  CANCELED: "Cancelado",
};

const ORDER_STATUS: Record<string, string> = {
  PENDING: "Pendiente de pago",
  PAID: "Pagado",
  CANCELED: "Cancelado",
  REFUNDED: "Reintegrado",
  FAILED: "Fallido",
};

const ORDER_ORIGIN: Record<string, string> = {
  PREVENTA_PACK: "Preventa",
  PACK_REDEMPTION: "Canje preventa",
  STANDARD_CHECKOUT: "Galería",
};

function labelFromMap(map: Record<string, string>, status: string): string {
  const key = status.trim();
  if (!key) return "—";
  return map[key] ?? key.replace(/_/g, " ").toLowerCase();
}

export function labelPreCompraOrderItemStatus(status: string): string {
  return labelFromMap(PRECOMPRA_ORDER_ITEM_STATUS, status);
}

export function labelPreCompraOrderStatus(status: string): string {
  return labelFromMap(PRECOMPRA_ORDER_STATUS, status);
}

export function labelDesignProjectStatus(status: string): string {
  return labelFromMap(DESIGN_PROJECT_STATUS, status);
}

export function labelPreventaOrderStatus(status: string): string {
  return labelFromMap(ORDER_STATUS, status);
}

export function labelOrderOrigin(origin: string | null | undefined): string {
  if (!origin) return "Pedido";
  return labelFromMap(ORDER_ORIGIN, origin);
}
