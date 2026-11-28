/**
 * ¿Este `Order` es un combo cobrado por fuera (o de regalo), y no un pedido con fotos?
 *
 * Los combos se guardan como `Order` PREVENTA_PACK, PAID y en $0, pero no tienen fotos:
 * son el cupo de la familia. El pedido con fotos se crea aparte cuando la familia elige
 * (`redemptionOrderId`). Por eso no van en "Pedidos" del fotógrafo (se ven en "Canjes")
 * y el admin los muestra como combo, no como un pedido digital vacío.
 *
 * Sin imports de Prisma para poder probarlo solo. Los valores son los mismos que
 * `EXTERNAL_VOUCHER_KIND`, `EXTERNAL_PREVENTA_KIND` y `EXTERNAL_SHARED_GIFT_LINK_KIND`.
 */

export const COMBO_EXTERNO_KINDS = [
  "EXTERNAL_PREPAID_PRINT_CREDIT",
  "EXTERNAL_PREVENTA_PACK",
  "EXTERNAL_SHARED_GIFT_LINK",
] as const;

export type ComboExternoKind = (typeof COMBO_EXTERNO_KINDS)[number];

export function comboExternoKind(order: {
  origin?: string | null;
  redemptionPaymentRefsJson?: unknown;
}): ComboExternoKind | null {
  if (order.origin !== "PREVENTA_PACK") return null;
  const refs = order.redemptionPaymentRefsJson;
  if (!refs || typeof refs !== "object" || Array.isArray(refs)) return null;
  const kind = (refs as { kind?: unknown }).kind;
  return (COMBO_EXTERNO_KINDS as readonly unknown[]).includes(kind) ? (kind as ComboExternoKind) : null;
}

export function esComboExterno(order: { origin?: string | null; redemptionPaymentRefsJson?: unknown }): boolean {
  return comboExternoKind(order) !== null;
}

export type ComboExternoResumen = {
  kind: ComboExternoKind;
  /** "Combo de regalo", "Link compartido de regalo", "Combo cobrado por fuera"… */
  titulo: string;
  /** Texto del combo, p. ej. "3 fotos impresas 15x20 de regalo". */
  detalle: string | null;
  /** Pedido con fotos que armó la familia; null si todavía no eligió. */
  pedidoId: number | null;
};

/** Cómo se presenta un combo en el admin. Null si el pedido no es un combo. */
export function resumenComboExterno(order: {
  origin?: string | null;
  redemptionPaymentRefsJson?: unknown;
  redemptionOrderId?: number | null;
}): ComboExternoResumen | null {
  const kind = comboExternoKind(order);
  if (!kind) return null;
  const refs = order.redemptionPaymentRefsJson as { label?: unknown; isGift?: unknown };
  const detalle = typeof refs.label === "string" && refs.label.trim() ? refs.label.trim() : null;
  const titulo =
    kind === "EXTERNAL_SHARED_GIFT_LINK"
      ? "Link compartido de regalo"
      : kind === "EXTERNAL_PREVENTA_PACK"
        ? "Pack cobrado por fuera"
        : refs.isGift === true
          ? "Combo de regalo"
          : "Combo cobrado por fuera";
  return {
    kind,
    titulo,
    detalle,
    pedidoId: kind === "EXTERNAL_SHARED_GIFT_LINK" ? null : (order.redemptionOrderId ?? null),
  };
}
