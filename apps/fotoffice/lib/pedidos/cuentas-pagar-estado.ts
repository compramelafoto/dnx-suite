/**
 * Cuentas a pagar (Entrega B1): estado, márgenes y fechas. Módulo PURO (sin base): lo usan la
 * ficha del pedido, la pantalla "A pagar" y sus pruebas.
 *
 * - Una cuenta está PAGADA si tiene un pago vigente (`paidAt`). Si no, VENCIDA cuando su
 *   vencimiento (día de Argentina) ya pasó, o PENDIENTE (con o sin vencimiento).
 * - Margen previsto = total del pedido − todos los costos (pagados o no).
 * - Margen real = cobrado − costos pagados.
 * Todo en centavos enteros.
 */
import { aCentavos, desdeCentavos } from "./plan-cuotas";

export const ESTADOS_CUENTA = ["PENDIENTE", "VENCIDA", "PAGADA"] as const;
export type EstadoCuenta = (typeof ESTADOS_CUENTA)[number];

export const ETIQUETA_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  PENDIENTE: "Pendiente",
  VENCIDA: "Vencida",
  PAGADA: "Pagada",
};

/** Color de etiqueta (`claseDeColorEtiqueta`) de cada estado. */
export const COLOR_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  PENDIENTE: "gris",
  VENCIDA: "rojo",
  PAGADA: "verde",
};

/** `vence`: "aaaa-mm-dd" o null (sin vencimiento); `hoy`: día de Argentina. */
export function estadoDeCuenta(c: { pagada: boolean; vence: string | null }, hoy: string): EstadoCuenta {
  if (c.pagada) return "PAGADA";
  if (c.vence !== null && c.vence < hoy) return "VENCIDA";
  return "PENDIENTE";
}

export type Margenes = {
  /** Todos los costos del pedido (pagados o no). */
  costos: number;
  costosPagados: number;
  costosPendientes: number;
  /** total − costos. */
  margenPrevisto: number;
  /** cobrado − costos pagados. */
  margenReal: number;
};

export function margenesDelPedido(d: { total: number; cobrado: number; cuentas: readonly { importe: number; pagada: boolean }[] }): Margenes {
  let costos = 0;
  let pagados = 0;
  for (const c of d.cuentas) {
    const v = aCentavos(c.importe);
    costos += v;
    if (c.pagada) pagados += v;
  }
  return {
    costos: desdeCentavos(costos),
    costosPagados: desdeCentavos(pagados),
    costosPendientes: desdeCentavos(costos - pagados),
    margenPrevisto: desdeCentavos(aCentavos(d.total) - costos),
    margenReal: desdeCentavos(aCentavos(d.cobrado) - pagados),
  };
}

/** Suma días a un "aaaa-mm-dd" (calendario, sin husos horarios). */
export function sumarDiasAFecha(ymd: string, dias: number): string {
  const [a, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Situaciones del filtro de "A pagar". */
export const SITUACIONES_A_PAGAR = ["vencidas", "proximos30", "pendientes", "pagadas"] as const;
export type SituacionAPagar = (typeof SITUACIONES_A_PAGAR)[number];

export const ETIQUETA_SITUACION_A_PAGAR: Record<SituacionAPagar, string> = {
  vencidas: "Vencidas",
  proximos30: "Próximos 30 días",
  pendientes: "Todas las pendientes",
  pagadas: "Pagadas",
};

export function esSituacionAPagar(v: unknown): v is SituacionAPagar {
  return typeof v === "string" && (SITUACIONES_A_PAGAR as readonly string[]).includes(v);
}
