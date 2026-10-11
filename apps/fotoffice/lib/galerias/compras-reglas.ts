/**
 * Reglas de las compras de fotos extra y de la descarga de originales (etapa 7, Entrega A2).
 * Módulo PURO: sin base ni red. Los valores de `status` tienen su CHECK en `20261102120000_fotoffice_etapa_7_galeria_venta`.
 */
import type { EstadoCliente, ModoDescarga } from "./constantes";

export const ESTADOS_COMPRA = ["PENDIENTE", "PAGADA", "CANCELADA"] as const;
export type EstadoCompra = (typeof ESTADOS_COMPRA)[number];
export const esEstadoCompra = (v: unknown): v is EstadoCompra => typeof v === "string" && (ESTADOS_COMPRA as readonly string[]).includes(v);

export const ETIQUETA_ESTADO_COMPRA: Record<EstadoCompra, string> = {
  PENDIENTE: "Pendiente de pago",
  PAGADA: "Pagada",
  CANCELADA: "Cancelada",
};

const TRANSICIONES: Record<EstadoCompra, readonly EstadoCompra[]> = {
  PENDIENTE: ["PAGADA", "CANCELADA"],
  PAGADA: [],
  CANCELADA: [],
};

export function puedeTransicionarCompra(desde: EstadoCompra, hacia: EstadoCompra): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export function validarTransicionCompra(desde: EstadoCompra, hacia: EstadoCompra): { ok: true } | { ok: false; error: string } {
  if (puedeTransicionarCompra(desde, hacia)) return { ok: true };
  if (desde === "PAGADA") return { ok: false, error: "La compra ya está pagada." };
  if (desde === "CANCELADA") return { ok: false, error: "La compra está cancelada: armá una nueva." };
  return { ok: false, error: "Esa compra no puede pasar a ese estado." };
}

/**
 * Fotos cuyo original puede bajar el cliente. Sólo con `downloadMode = SELECCIONADAS`: las pagadas siempre, y
 * las incluidas una vez enviada la selección (estado EN_REVISION o FINALIZADO). Devuelve ids sin repetir.
 */
export function fotosDescargables(args: {
  downloadMode: ModoDescarga;
  estadoCliente: EstadoCliente;
  incluidas: Iterable<string>;
  pagadas: Iterable<string>;
}): string[] {
  if (args.downloadMode !== "SELECCIONADAS") return [];
  const out = new Set<string>(args.pagadas);
  if (args.estadoCliente === "EN_REVISION" || args.estadoCliente === "FINALIZADO") for (const id of args.incluidas) out.add(id);
  return [...out];
}

export function puedeDescargarOriginal(args: Parameters<typeof fotosDescargables>[0] & { fotoId: string }): boolean {
  return fotosDescargables(args).includes(args.fotoId);
}
