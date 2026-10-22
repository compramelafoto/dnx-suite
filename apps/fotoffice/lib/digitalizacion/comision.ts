import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { withholdingForPayment } from "@/lib/platform-fee/debt";
import { pesos } from "./entrega";

/**
 * Lo puro de la comisión de plataforma sobre los pedidos de digitalización (spec 2026-10-22, F1).
 * Sin base ni red; todo en centavos y con enteros.
 *
 * - **Cobro manual** (o de Mercado Pago sin retención: abierto antes de la entrega): se devenga la
 *   comisión entera como deuda del negocio con la plataforma.
 * - **Mercado Pago con retención:** se retiene la propia más la deuda que entre (`marketplace_fee`);
 *   al acreditar sólo se asienta la parte que canceló deuda.
 * - **0 bps** (DNX, que es la plataforma): nada, en ningún camino.
 */

/** Comisión propia de un cobro: `round(monto × bps / 10000)`. 0 con 0 bps o un monto inválido. */
export function comisionPropia(montoMinor: number, bps: number): number {
  if (bps <= 0) return 0;
  return splitMinorByPlatformFee(montoMinor, bps).feeMinor;
}

export type CobroParaComision = { id: string; voidedAt: Date | null; amountMinor: number };

/** Los cobros que devengan: vigentes, sin comisión marcada y con comisión mayor que 0 centavos. */
export function cobrosQueDevengan(cobros: readonly CobroParaComision[], conComision: ReadonlySet<string>, bps: number): { id: string; comisionMinor: number }[] {
  if (bps <= 0) return [];
  return cobros
    .filter((c) => c.voidedAt === null && !conComision.has(c.id))
    .map((c) => ({ id: c.id, comisionMinor: comisionPropia(c.amountMinor, bps) }))
    .filter((c) => c.comisionMinor > 0);
}

export type Retencion = { propioMinor: number; retenidoMinor: number };

/**
 * Cuánto retener de un pago de Mercado Pago: la comisión propia y después la deuda arrastrada
 * (`withholdingForPayment`, igual que socios y reservas). Se acota a `pago − 1` centavo porque el
 * adaptador (y Mercado Pago) rechazan una comisión igual al importe: lo que no entra sigue de deuda.
 * null con 0 bps: DNX no se retiene a sí misma, ni siquiera deuda.
 */
export function retencionParaPago(input: { paymentMinor: number; bps: number; pendingDebtMinor: number }): Retencion | null {
  if (input.bps <= 0) return null;
  const propio = comisionPropia(input.paymentMinor, input.bps);
  const r = withholdingForPayment({ paymentMinor: input.paymentMinor, ownFeeMinor: propio, pendingDebtMinor: input.pendingDebtMinor });
  const tope = Math.max(0, input.paymentMinor - 1);
  const retenido = Math.min(r.withholdMinor, tope);
  return { propioMinor: Math.min(propio, retenido), retenidoMinor: retenido };
}

/** Lo que viaja en la `metadata` de la preferencia (texto: el adaptador sólo acepta texto). */
export function metadatosDeRetencion(r: Retencion): Record<string, string> {
  return { fo_comision_propia_minor: String(r.propioMinor), fo_retencion_minor: String(r.retenidoMinor) };
}

const centavosDeTexto = (v: unknown): number | null => (typeof v === "string" && /^\d{1,12}$/.test(v) ? Number(v) : null);

/**
 * Lo que retuvo la plataforma de un pago leído. La retención es la que informa Mercado Pago en
 * `fee_details` (tipo `application_fee`, el `marketplace_fee` de la preferencia); si no viene, la
 * de los metadatos. La propia sale de los metadatos (la tasa de cuando se abrió el pago); si no
 * están, se recalcula con la de hoy. Nunca más que lo retenido. null si no hubo retención.
 */
export function leerRetencionDelPago(raw: Record<string, unknown>, montoMinor: number, bpsDeHoy: number): Retencion | null {
  let deMp: number | null = null;
  if (Array.isArray(raw.fee_details)) {
    for (const fila of raw.fee_details) {
      if (typeof fila !== "object" || fila === null) continue;
      const { type, amount } = fila as { type?: unknown; amount?: unknown };
      if (type !== "application_fee" || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) continue;
      deMp = (deMp ?? 0) + Math.round(amount * 100);
    }
  }
  const meta = (typeof raw.platform_fee_metadata === "object" && raw.platform_fee_metadata !== null ? raw.platform_fee_metadata : {}) as Record<string, unknown>;
  const retenido = deMp ?? centavosDeTexto(meta.withheld_minor);
  if (retenido === null || retenido <= 0) return null;
  const propio = centavosDeTexto(meta.own_minor) ?? comisionPropia(montoMinor, bpsDeHoy);
  return { retenidoMinor: retenido, propioMinor: Math.min(propio, retenido) };
}

/** La parte de lo retenido que canceló deuda: retenido − propio, acotada a la deuda de este momento. */
export function descargaDeDeuda(input: { retenidoMinor: number; propioMinor: number; deudaMinor: number }): number {
  return Math.max(0, Math.min(input.retenidoMinor - input.propioMinor, input.deudaMinor));
}

/** "5 %", "2,5 %". */
export function porcentaje(bps: number): string {
  return `${String(bps / 100).replace(".", ",")} %`;
}

export function notaDevengado(n: { bps: number; pedidoNumero: string; recibo: string; comisionMinor: number }): string {
  return `Comisión ${porcentaje(n.bps)} · pedido ${n.pedidoNumero} · recibo ${n.recibo} · ${pesos(n.comisionMinor)}`;
}

export function notaRetenido(n: { bps: number; pedidoNumero: string; recibo: string; retenidoMinor: number; propioMinor: number; descargaMinor: number }): string {
  return `Comisión ${porcentaje(n.bps)} retenida por Mercado Pago · pedido ${n.pedidoNumero} · recibo ${n.recibo} · ${pesos(n.retenidoMinor)} (${pesos(n.propioMinor)} de este cobro y ${pesos(n.descargaMinor)} de deuda)`;
}

export function notaReverso(n: { pedidoNumero: string; recibo: string }): string {
  return `Cobro anulado: se revierte la comisión devengada · pedido ${n.pedidoNumero} · recibo ${n.recibo}`;
}

/** Primer instante del mes en curso en hora argentina (UTC−3, sin horario de verano). */
export function inicioDelMesArgentino(ahora: Date): Date {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "numeric" }).formatToParts(ahora);
  const anio = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0));
}
