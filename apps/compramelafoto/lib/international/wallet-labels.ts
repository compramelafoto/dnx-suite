import { formatMoney } from "./money";
import { repaidFromNote } from "./wallet";

export function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD" }).format(cents / 100);
}

export type MovementForLabel = {
  type: string;
  amountUsdCents: number;
  orderId: number | null;
  localCurrency: string | null;
  localAmount: number | null;
  note: string | null;
};

/** Texto de un movimiento del saldo, en moneda local y dólares cuando corresponde. */
export function movementLabel(m: MovementForLabel): string {
  switch (m.type) {
    case "COMMISSION": {
      const local = m.localCurrency && m.localAmount != null ? `${formatMoney(m.localAmount, m.localCurrency)} = ` : "";
      return `Venta pedido #${m.orderId ?? "?"} · comisión ${local}${formatUsdCents(Math.abs(m.amountUsdCents))}`;
    }
    case "TOPUP":
      return `Recarga ${formatUsdCents(m.amountUsdCents)}`;
    case "ADVANCE":
      return `Adelanto ${formatUsdCents(m.amountUsdCents)}`;
    case "ADVANCE_REPAID":
      return `Devolución del adelanto ${formatUsdCents(repaidFromNote(m.note))}`;
    default:
      return `Ajuste: ${m.note ?? ""}`.trim();
  }
}
