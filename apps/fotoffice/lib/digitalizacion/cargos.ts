/**
 * Cargos extra de la entrega de videos (spec 2026-10-22, E6, E7 y E9). Módulo PURO: sin base, sin
 * entorno y con el reloj inyectado. Lo usan el servidor (`servidor/cargos.ts`) y la página pública
 * (también desde el navegador, para mostrar el precio del envío mientras se elige la dirección).
 */
import { cotizarEnvio, puntoValido, type Punto } from "@/lib/impresiones/envio";
import { DIAS_VIGENCIA, finDelDiaArgentino, videosVencidos, type FranjaEnvio } from "./entrega";

export const TIPOS_CARGO = ["DESCARGA_EXTRA", "EXTENSION", "ENVIO"] as const;
export type TipoCargo = (typeof TIPOS_CARGO)[number];
export type EstadoCargo = "PENDIENTE" | "APLICADO" | "ANULADO";
/** null = no se pidió. */
export type EstadoEnvio = "A_COORDINAR" | "A_PAGAR" | "CONFIRMADO" | "ENTREGADO";

/** Ningún cargo de descarga o extensión baja de esto (E7). */
export const MINIMO_CARGO_ARS = 100;
export const PORCENTAJE_DESCARGA_EXTRA = 25;
export const PORCENTAJE_EXTENSION = 50;
const DIA_MS = 24 * 60 * 60 * 1000;

const pesosEnteros = (n: number) => Math.max(MINIMO_CARGO_ARS, Math.round(Number.isFinite(n) ? n : 0));

// --- Precios (E7) -----------------------------------------------------------------------------

/** 25 % del precio unitario del trabajo del video, en pesos enteros y con mínimo de 100. */
export function precioDescargaExtra(precioUnitario: number): number {
  return pesosEnteros((precioUnitario * PORCENTAJE_DESCARGA_EXTRA) / 100);
}

/** 50 % del total original del pedido (sin cargos extra), en pesos enteros y con mínimo de 100. */
export function precioExtension(totalOriginalArs: number): number {
  return pesosEnteros((totalOriginalArs * PORCENTAJE_EXTENSION) / 100);
}

/** El total del pedido sin los cargos extra que siguen en pie (pendientes o aplicados). */
export function totalOriginal(totalArs: number, cargos: readonly { montoArs: number; estado: string }[]): number {
  const extra = cargos.filter((c) => c.estado !== "ANULADO").reduce((s, c) => s + Math.round(c.montoArs * 100), 0);
  return Math.max(0, Math.round(totalArs * 100) - extra) / 100;
}

type ItemLeido = { id: unknown; cantidad: unknown; precioUnitario: unknown };

/**
 * El precio por unidad del trabajo de un video. El trabajo (`FotofficeProyecto`) guarda el índice
 * del ítem del pedido que lo originó (`pedidoItemIndex`): de ahí sale el neto del renglón dividido
 * por su cantidad (con su descuento, si tiene) o, si no hay renglón guardado, su precio de lista.
 * Sin índice o con un ítem que no está (trabajo creado a mano, pedido migrado), el total original
 * repartido entre los videos listos del pedido.
 */
export function precioUnitarioDelTrabajo(a: {
  items: readonly ItemLeido[];
  renglones: Record<string, { neto?: unknown } | undefined>;
  pedidoItemIndex: number | null;
  totalOriginal: number;
  videosListos: number;
}): { precio: number; origen: "ITEM" | "REPARTO" } {
  const it = a.pedidoItemIndex !== null && Number.isInteger(a.pedidoItemIndex) ? a.items[a.pedidoItemIndex] : undefined;
  const cantidad = typeof it?.cantidad === "number" && Number.isFinite(it.cantidad) && it.cantidad > 0 ? it.cantidad : null;
  if (it && cantidad !== null) {
    const neto = typeof it.id === "string" ? a.renglones[it.id]?.neto : undefined;
    if (typeof neto === "number" && Number.isFinite(neto) && neto > 0) return { precio: Math.round((neto / cantidad) * 100) / 100, origen: "ITEM" };
    if (typeof it.precioUnitario === "number" && Number.isFinite(it.precioUnitario) && it.precioUnitario > 0) return { precio: it.precioUnitario, origen: "ITEM" };
  }
  return { precio: Math.round((a.totalOriginal / Math.max(1, a.videosListos)) * 100) / 100, origen: "REPARTO" };
}

// --- Envío de cassettes (E9) ------------------------------------------------------------------

/** Km del estudio a la dirección: línea recta × 1,3, a un decimal (la misma cuenta que Impresiones). null sin puntos válidos. */
export function kmDeEnvio(estudio: Punto | null, destino: Punto | null): number | null {
  const q = cotizarEnvio({ estudio, destino, baseCents: 0, porKmCents: 0, maxKm: null });
  return q.ok ? q.km : null;
}

/** La primera franja (por km, de menor a mayor) que llega a `km`; null si `km` pasa la última. */
export function franjaParaKm(franjas: readonly FranjaEnvio[], km: number): FranjaEnvio | null {
  return [...franjas].sort((a, b) => a.hastaKm - b.hastaKm).find((f) => f.hastaKm >= km) ?? null;
}

export type CotizacionCassettes =
  | { estado: "A_PAGAR"; km: number; precioArs: number }
  /** La franja dice 0 pesos: el envío va sin cargo. */
  | { estado: "CONFIRMADO"; km: number; precioArs: 0 }
  | { estado: "A_COORDINAR"; km: number | null; motivo: "SIN_ESTUDIO" | "SIN_DESTINO" | "SIN_FRANJAS" | "FUERA_DE_FRANJAS" };

export function cotizarEnvioCassettes(a: { estudio: Punto | null; destino: Punto | null; franjas: readonly FranjaEnvio[] }): CotizacionCassettes {
  if (!a.estudio || !puntoValido(a.estudio.lat, a.estudio.lon)) return { estado: "A_COORDINAR", km: null, motivo: "SIN_ESTUDIO" };
  const km = kmDeEnvio(a.estudio, a.destino);
  if (km === null) return { estado: "A_COORDINAR", km: null, motivo: "SIN_DESTINO" };
  if (a.franjas.length === 0) return { estado: "A_COORDINAR", km, motivo: "SIN_FRANJAS" };
  const f = franjaParaKm(a.franjas, km);
  if (!f) return { estado: "A_COORDINAR", km, motivo: "FUERA_DE_FRANJAS" };
  return f.precioArs > 0 ? { estado: "A_PAGAR", km, precioArs: f.precioArs } : { estado: "CONFIRMADO", km, precioArs: 0 };
}

// --- Qué se puede pedir -----------------------------------------------------------------------

type EntregaVideos = { cancelado: boolean; videosVencenAt: Date | null; videosBorradosAt: Date | null };

function videosVigentes(e: EntregaVideos, ahora: Date): boolean {
  return !e.cancelado && e.videosBorradosAt === null && e.videosVencenAt !== null && !videosVencidos(e, ahora);
}

/** "Comprar otra descarga": con los videos vigentes y ese video sin borrar. */
export function puedeComprarDescarga(e: EntregaVideos, video: { videoBorradoAt: Date | null }, ahora: Date): boolean {
  return videosVigentes(e, ahora) && video.videoBorradoAt === null;
}

/** "Extender 30 días": con los videos vigentes (borrados no vuelven). */
export function puedeExtender(e: EntregaVideos, ahora: Date): boolean {
  return videosVigentes(e, ahora);
}

/** "Pedir envío de los cassettes": antes de que venzan y si el envío no está ya confirmado o entregado. */
export function puedePedirEnvio(e: { cancelado: boolean; cassettesVencenAt: Date | null; envioEstado: string | null }, ahora: Date): boolean {
  if (e.cancelado || !e.cassettesVencenAt || e.cassettesVencenAt.getTime() <= ahora.getTime()) return false;
  return e.envioEstado !== "CONFIRMADO" && e.envioEstado !== "ENTREGADO";
}

// --- Efectos al pagar -------------------------------------------------------------------------

/** El vencimiento después de una extensión paga: 30 días desde el vigente (o desde hoy, si ya pasó), al final del día argentino. */
export function vencimientoExtendido(videosVencenAt: Date | null, ahora: Date): Date {
  const desde = Math.max(videosVencenAt?.getTime() ?? 0, ahora.getTime());
  return finDelDiaArgentino(new Date(desde + DIAS_VIGENCIA * DIA_MS));
}

/**
 * El saldo que traba los videos (E4): el del pedido sin lo que falta de los cargos extra sin pagar.
 * Pedir una descarga extra o una extensión sube el saldo del pedido, pero no puede apagar los
 * videos que el cliente ya pagó. Todo en centavos.
 */
export function saldoParaVideos(saldoPedidoMinor: number, pendientesMinor: readonly number[]): number {
  return Math.max(0, saldoPedidoMinor - pendientesMinor.reduce((s, m) => s + Math.max(0, m), 0));
}

// --- Textos -----------------------------------------------------------------------------------

/** El renglón del pedido de cada cargo (lo ve el cliente en la página del pedido y en el recibo). */
export function conceptoDeCargo(tipo: TipoCargo, video: string | null): string {
  if (tipo === "DESCARGA_EXTRA") return video ? `Descarga extra · ${video}` : "Descarga extra de un video";
  if (tipo === "EXTENSION") return "Extensión de 30 días de los videos";
  return "Envío de los cassettes";
}

export const ETIQUETA_ENVIO: Record<EstadoEnvio, string> = {
  A_COORDINAR: "A coordinar",
  A_PAGAR: "Pendiente de pago",
  CONFIRMADO: "Confirmado",
  ENTREGADO: "Entregado",
};

export function esEstadoEnvio(v: unknown): v is EstadoEnvio {
  return v === "A_COORDINAR" || v === "A_PAGAR" || v === "CONFIRMADO" || v === "ENTREGADO";
}
