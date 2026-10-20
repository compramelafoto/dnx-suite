import { formatMinorArs } from "@/lib/membership/money";

/**
 * Candado del saldo (módulo PURO): un trabajo de un pedido que todavía debe plata no se
 * entrega. Acá vive la cuenta del saldo y el texto del rechazo; el motor de recorridos lo
 * aplica con `exigirPedidoPagado` (`./candado-saldo`).
 */

/**
 * Saldo de un pedido en centavos: el total menos los cobros vigentes (los dos en pesos). Un
 * pedido cancelado no debe nada y cobrar de más no da saldo negativo. Es la misma cuenta que
 * el tablero de trabajos en curso (`lib/proyectos/en-curso.ts`).
 */
export function saldoPedidoMinor(p: { totalArs: number; cobradoArs: number; status: string }): number {
  if (p.status === "CANCELADO") return 0;
  return Math.max(0, Math.round((p.totalArs - p.cobradoArs) * 100));
}

/** "El pedido P-12 debe $ 5.000. Cobrá el saldo antes de entregar." (sin los `,00`). */
export function mensajeCandado(numero: string, saldoMinor: number): string {
  const saldo = formatMinorArs(saldoMinor).replace(/,00$/, "");
  return `El pedido ${numero} debe ${saldo}. Cobrá el saldo antes de entregar.`;
}
