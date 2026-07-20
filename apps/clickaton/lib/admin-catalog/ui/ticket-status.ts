import { salesStatusOf } from "../domain/availability";
import type {
  AvailabilityRecord,
  ProductListItem,
  ProductRecord,
  TicketTypeItemRecord,
  TicketTypeRecord,
} from "../domain/types";
import { LOW_STOCK_THRESHOLD } from "./money-ui";

export type TicketKitKind = "entrada" | "entrada_producto" | "kit";

export type TicketConfigStatus = "complete" | "incomplete" | "warnings";

export type TicketCommercialStatus =
  | "inactive"
  | "sale_future"
  | "on_sale"
  | "sale_ended"
  | "no_period"
  | "unlimited"
  | "no_capacity_left"
  | "sold_out"
  | "incomplete"
  | "active";

export function kitKindOf(items: TicketTypeItemRecord[]): TicketKitKind {
  if (items.length === 0) return "entrada";
  if (items.length === 1) return "entrada_producto";
  return "kit";
}

export function kitKindLabel(kind: TicketKitKind): string {
  if (kind === "entrada") return "Entrada";
  if (kind === "entrada_producto") return "Entrada + producto";
  return "Kit";
}

export function salesStatusLabel(
  status: AvailabilityRecord["salesStatus"],
): string {
  switch (status) {
    case "inactive":
      return "Inactiva";
    case "not_started":
      return "Venta futura";
    case "open":
      return "En venta";
    case "ended":
      return "Venta finalizada";
    default:
      return status;
  }
}

/**
 * Completitud administrativa (no exige productos: entrada simple válida).
 * Incomplete = datos base inválidos o inconsistentes.
 * Warnings = completa pero con referencias inactivas / stock bajo / sin período.
 */
export function evaluateTicketConfiguration(
  ticket: TicketTypeRecord,
  productsById?: Map<string, ProductRecord | ProductListItem>,
): {
  status: TicketConfigStatus;
  reasons: string[];
  warnings: string[];
} {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!ticket.name.trim()) reasons.push("Falta nombre.");
  if (!ticket.code.trim()) reasons.push("Falta código.");
  if (!Number.isInteger(ticket.priceAmount) || ticket.priceAmount < 0) {
    reasons.push("Precio inválido.");
  }
  if (
    ticket.salesStartAt &&
    ticket.salesEndAt &&
    ticket.salesEndAt.getTime() < ticket.salesStartAt.getTime()
  ) {
    reasons.push("Período de venta inconsistente.");
  }
  if (ticket.capacity !== null && (!Number.isInteger(ticket.capacity) || ticket.capacity < 1)) {
    reasons.push("Cupo inválido.");
  }

  for (const item of ticket.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      reasons.push("Cantidad de composición inválida.");
    }
    const product = productsById?.get(item.productId);
    if (productsById && !product) {
      reasons.push("Producto de composición inexistente.");
      continue;
    }
    if (product && !product.isActive) {
      warnings.push(`Producto inactivo: ${product.name}`);
    }
    if (item.productVariantId && product) {
      const variant = product.variants.find((v) => v.id === item.productVariantId);
      if (!variant) {
        reasons.push("Variante de composición inexistente.");
      } else {
        if (!variant.isActive) warnings.push(`Variante inactiva: ${variant.name}`);
        const available = Math.max(0, variant.stock - variant.reservedStock);
        if (available <= 0) warnings.push(`Sin stock: ${variant.name}`);
        else if (available <= LOW_STOCK_THRESHOLD) {
          warnings.push(`Poco stock: ${variant.name}`);
        }
        if (variant.priceAmount == null) {
          warnings.push(`Sin precio adicional en variante: ${variant.name}`);
        }
      }
    } else if (
      product &&
      product.variants.length > 0 &&
      !item.requiresVariantChoice &&
      !item.productVariantId
    ) {
      warnings.push(
        `Producto con variantes sin variante fija ni selección: ${product.name}`,
      );
    }
  }

  if (!ticket.salesStartAt && !ticket.salesEndAt) {
    warnings.push("Sin período de venta configurado.");
  }

  if (reasons.length) return { status: "incomplete", reasons, warnings };
  if (warnings.length) return { status: "warnings", reasons, warnings };
  return { status: "complete", reasons, warnings };
}

export function commercialStatuses(input: {
  ticket: TicketTypeRecord;
  availability?: AvailabilityRecord | null;
  config: TicketConfigStatus;
  now?: Date;
}): string[] {
  const labels: string[] = [];
  if (!input.ticket.isActive) labels.push("Inactiva");
  else labels.push("Activa");

  if (input.config === "incomplete") labels.push("Configuración incompleta");

  const sales =
    input.availability?.salesStatus ??
    salesStatusOf({
      isActive: input.ticket.isActive,
      salesStartAt: input.ticket.salesStartAt,
      salesEndAt: input.ticket.salesEndAt,
      now: input.now,
    });

  if (!input.ticket.salesStartAt && !input.ticket.salesEndAt) {
    labels.push("Sin período");
  } else {
    labels.push(salesStatusLabel(sales));
  }

  if (input.availability) {
    if (input.availability.isUnlimited) labels.push("Cupo ilimitado");
    else if (input.availability.isSoldOut) labels.push("Agotada");
    else if (input.availability.available === 0) labels.push("Sin cupo");
  } else if (input.ticket.capacity === null) {
    labels.push("Cupo ilimitado");
  }

  return [...new Set(labels)];
}

/** datetime-local value from Date (local wall clock). */
export function toDatetimeLocalValue(date: Date | null | undefined): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatArDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
