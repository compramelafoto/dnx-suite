/**
 * Lo PURO de la venta de fotos extra en el enlace del cliente (etapa 7, Entrega A2): la referencia que viaja en
 * la preferencia de Mercado Pago y vuelve en el aviso, los mensajes para el cliente y lo que viaja del
 * servidor al navegador. Sin base, sin red y sin `server-only`: lo usan el servidor y las pantallas.
 */
import type { ConfigVenta } from "./precios";
import { formatearCentavos } from "./precios";

export { hechosDelPago, paymentIdValido } from "@/lib/pedidos/mp-puro";

export const PREFIJO_REFERENCIA_COMPRA = "fo-galcompra:";

export function referenciaCompra(compraId: string): string {
  return `${PREFIJO_REFERENCIA_COMPRA}${compraId}`;
}

/** El id de compra que viaja en un pago de Mercado Pago, o null si el pago es de otra cosa. */
export function compraDeReferencia(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith(PREFIJO_REFERENCIA_COMPRA)) return null;
  const id = raw.slice(PREFIJO_REFERENCIA_COMPRA.length).trim();
  return id.length > 0 && id.length <= 64 ? id : null;
}

/** El id de una compra que viene de la dirección (`?compra=`): forma de id, nada más. */
export function idDeCompraValido(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
}

/** ¿Mercado Pago dice que el pago está aprobado? Igual que en pedidos y en la tienda. */
export function pagoAprobado(pago: { status: string; rawSanitized: Record<string, unknown> }): boolean {
  const crudo = pago.rawSanitized.status;
  if (typeof crudo === "string") return crudo === "approved";
  return pago.status === "APPROVED";
}

export const MENSAJES_PAGO_GALERIA = {
  enlaceInvalido: "Este enlace ya no es válido.",
  sinVenta: "Esta galería no vende fotos extra.",
  sinExtras: "No tenés fotos extra para pagar.",
  yaEnviada: "Tu selección ya fue enviada, así que no se puede pagar desde acá. Escribinos.",
  sinCobros: "La organización todavía no tiene los cobros habilitados. Escribile para pagar de otra forma.",
  sinDireccion: "No pudimos abrir el pago. Escribile a la organización.",
  sinEnlace: "No pudimos abrir el pago. Escribile a la organización.",
  fallo: "No pudimos abrir el pago. Probá de nuevo en unos minutos.",
  demasiados: "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.",
} as const;

/** Lo que el servidor le manda al navegador de una galería con venta. */
export type VistaVenta = {
  config: ConfigVenta;
  /** Fotos que el cliente ya pagó (compras PAGADAS). */
  pagadas: string[];
};

export function textoFotosExtra(n: number): string {
  return n === 1 ? "1 foto extra" : `${n} fotos extra`;
}

/** Aviso del repaso de «Enviar selección» y del servidor mientras queden extras sin pagar. */
export function mensajeExtrasSinPagar(n: number): string {
  return n === 1
    ? "Todavía tenés 1 foto extra sin pagar. Pagala para poder enviar tu selección, o quitala de la selección."
    : `Todavía tenés ${n} fotos extra sin pagar. Pagalas para poder enviar tu selección, o quitá las que no quieras.`;
}

export const MENSAJE_VENTA_SIN_ENVIO = "En esta galería no se envía una selección: el final es el pago de tus fotos.";

/** «3 extra · $ 4.500,00» para la barra fija. */
export function textoBarraExtras(extras: number, totalCents: number): string {
  return `${extras} extra · ${formatearCentavos(totalCents)}`;
}

// --- Vuelta de Mercado Pago -------------------------------------------------------------------------------

export type ResultadoVueltaGaleria =
  | "acreditado" | "ya_acreditado" | "no_aprobado" | "sin_pago" | "sin_cobros" | "no_disponible" | "sin_aplicar" | "fallo";

export type AvisoDePagoGaleria = { tono: "ok" | "info" | "error"; texto: string };

const PENDIENTE = "Tu pago está en proceso. Cuando se acredite, tus fotos aparecen como compradas.";

/**
 * El aviso de la página cuando el cliente vuelve de Mercado Pago. `verificacion` sólo viene con `pago=ok`; un
 * `pago=ok` que Mercado Pago no confirma NUNCA muestra el agradecimiento. Sólo textos fijos.
 */
export function avisoDeVueltaGaleria(pago: unknown, verificacion: ResultadoVueltaGaleria | null): AvisoDePagoGaleria | null {
  if (pago === "error") return { tono: "error", texto: "No se pudo completar el pago. Podés intentarlo de nuevo." };
  if (pago === "pendiente") return { tono: "info", texto: PENDIENTE };
  if (pago !== "ok") return null;
  switch (verificacion) {
    case "acreditado":
    case "ya_acreditado":
      return { tono: "ok", texto: "¡Gracias! Recibimos tu pago. Tus fotos ya figuran como compradas." };
    case "sin_aplicar":
      return { tono: "info", texto: "Recibimos tu pago, pero la organización tiene que revisarlo a mano. Ya le avisamos." };
    case "fallo":
      return { tono: "info", texto: "No pudimos confirmar tu pago por ahora. Si ya pagaste, escribinos." };
    default:
      return { tono: "info", texto: PENDIENTE };
  }
}
