/**
 * Ayudas de las pantallas de Pedidos. Módulo PURO (lo importan los componentes del navegador):
 * sin base, sin sesión y sin costos.
 */

import { aCentavos, desdeCentavos } from "./plan-cuotas";

/** "$ 120.000" sin decimales; con centavos sólo si los tiene ("$ 40.000,50"). */
export function pesosPedido(n: number): string {
  const conCentavos = aCentavos(n) % 100 !== 0;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: conCentavos ? 2 : 0,
    maximumFractionDigits: conCentavos ? 2 : 0,
  }).format(conCentavos ? n : Math.round(n));
}

/** Pesos con centavos, como va en el recibo ("$ 120.000,50"). */
export function pesosConCentavos(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** "aaaa-mm-dd" → "dd/mm/aaaa" (o "—"). */
export function fechaCorta(ymd: string | null | undefined): string {
  return ymd ? ymd.split("-").reverse().join("/") : "—";
}

export type CuotaParaCobro = { id: string; position: number; dueDate: string; amountArs: number; saldo: number };

/** El importe sugerido de un cobro: el saldo de la cuota más vieja que todavía tiene saldo (0 si no hay). */
export function importeSugerido(cuotas: readonly CuotaParaCobro[]): number {
  const conSaldo = cuotas.filter((c) => aCentavos(c.saldo) > 0).sort((a, b) => a.position - b.position);
  return conSaldo[0]?.saldo ?? 0;
}

/** Suma exacta (a centavos) de importes en pesos. */
export function sumarPesos(importes: readonly number[]): number {
  return desdeCentavos(importes.reduce((s, n) => s + aCentavos(n), 0));
}

/**
 * Lee un importe escrito a mano ("40000", "40.000", "40000,50", "40.000,50"). Null si no es un
 * número positivo con hasta dos decimales.
 */
export function leerImporte(texto: string): number | null {
  const t = texto.trim().replace(/\s|\$/g, "");
  if (!t) return null;
  let normal: string;
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, "");
  else normal = t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? desdeCentavos(aCentavos(n)) : null;
}

/** Clave de idempotencia del formulario de cobro: una por cada vez que se abre el diálogo. */
export function claveDeCobro(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `cobro-${c.randomUUID()}`;
  return `cobro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Textos por omisión cuando no hay una plantilla del canal (las variables las completa el servidor).
 * Con recibo: el enlace del recibo; sin recibo: el enlace del pedido.
 */
export const TEXTOS_POR_OMISION = {
  recibo: {
    asunto: "Recibo de tu pago N° [recibo_numero]",
    EMAIL: "Hola[si:nombre], [nombre][/si]:\n\nTe mandamos el recibo de tu pago de [recibo_importe]:\n\n[recibo_enlace]\n\n[firma]",
    WHATSAPP: "¡Hola[si:nombre], [nombre][/si]! Te mandamos el recibo de tu pago de [recibo_importe]: [recibo_enlace]",
  },
  pedido: {
    asunto: "Tu pedido N° [pedido_numero]",
    EMAIL: "Hola[si:nombre], [nombre][/si]:\n\nEn este enlace podés ver tu pedido, el plan de pagos y los recibos:\n\n[pedido_enlace]\n\n[firma]",
    WHATSAPP: "¡Hola[si:nombre], [nombre][/si]! Acá podés ver tu pedido N° [pedido_numero], el plan de pagos y los recibos: [pedido_enlace]",
  },
} as const;
