import { escaparHtml } from "@/lib/presupuesto-automatico/resumen";
import { archivoDeMensaje } from "../archivo-de-mensaje";
import type { Leido, PagoMp, Veredicto } from "./veredicto";

/**
 * PURO. El bot cobra por transferencia: cuando el cliente manda el comprobante en un chat con un
 * pedido del bot esperando el pago, ¿se acredita solo o lo revisa una persona?
 *
 * Se acredita SÓLO si se cumple todo:
 *   - el veredicto es CONFIRMADO o PROBABLE y el pago de Mercado Pago está `approved`;
 *   - el monto es la seña o el total de un pedido que espera el pago (diferencia menor a $1);
 *   - el pago no es anterior a la creación de ese pedido (con 10 minutos de margen);
 *   - ese pago de Mercado Pago no se usó ya para otro pedido o cobro;
 *   - con PROBABLE (por monto y hora, sin el número de operación) además: el pago está a 30 minutos
 *     o menos de la hora del comprobante, es el único pago de ese monto en esa ventana y, si los dos
 *     traen nombre, el de quien paga en Mercado Pago coincide con el del comprobante;
 *   - el estudio tiene encendida la confirmación automática (`autoAcreditarComprobante`).
 * Si no es un comprobante, el bot sigue como siempre. En cualquier otro caso, pasa a una persona.
 */

export type PedidoEsperandoPago = {
  tipo: "IMPRESION" | "CATALOGO";
  id: string;
  numero: string;
  creadoEn: Date;
  /** En centavos. */
  totalCents: number;
  /** En centavos; null si el pedido no tiene seña. */
  senaCents: number | null;
};

export type EntradaAutoComprobante = {
  veredicto: Veredicto;
  /** Lo que se leyó del comprobante (hora y nombre de quien paga). */
  leido: Pick<Leido, "fecha" | "origen" | "monto">;
  /** Los pagos de Mercado Pago del mismo monto cerca de la fecha (con PROBABLE). */
  candidatos: readonly PagoMp[];
  /** Los pedidos del chat que esperan el pago, del más nuevo al más viejo. */
  pedidos: readonly PedidoEsperandoPago[];
  /** ¿El id del pago de Mercado Pago ya figura en otro pedido o cobro? */
  pagoYaUsado: boolean;
  autoConfirmar: boolean;
};

export type DecisionAutoComprobante =
  /** No es un comprobante: el bot sigue con la charla. */
  | { accion: "SEGUIR" }
  | { accion: "ACREDITAR"; pedido: PedidoEsperandoPago; pago: PagoMp; cubre: "SENA" | "TOTAL" }
  | { accion: "A_PERSONA"; motivo: string; pedido: PedidoEsperandoPago | null };

export const TOLERANCIA_CENTS = 100;
export const MARGEN_ANTERIOR_MS = 10 * 60_000;
/** Con PROBABLE, la acreditación automática exige que el pago esté a esta distancia de la hora del comprobante. */
export const VENTANA_PROBABLE_MS = 30 * 60_000;

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const palabrasLargas = (s: string) => new Set(normalizar(s).split(/[^a-z]+/).filter((p) => p.length >= 4));

/** ¿El nombre de Mercado Pago y el del comprobante comparten una palabra de 4 letras o más? Si falta uno, sí. */
export function nombresCoinciden(pagador: string | null, origen: string | null): boolean {
  if (!pagador?.trim() || !origen?.trim()) return true;
  const deOrigen = palabrasLargas(origen);
  const dePagador = palabrasLargas(pagador);
  if (deOrigen.size === 0 || dePagador.size === 0) return true;
  return [...dePagador].some((p) => deOrigen.has(p));
}

/** Los controles extra de un PROBABLE para acreditar solo; null si pasa. */
function problemaDelProbable(e: EntradaAutoComprobante, pago: PagoMp): string | null {
  const hora = e.leido.fecha ? Date.parse(e.leido.fecha) : NaN;
  if (Number.isNaN(hora)) return "el comprobante no tiene la hora legible";
  const cerca = (p: PagoMp) => {
    const t = p.fecha ? Date.parse(p.fecha) : NaN;
    return !Number.isNaN(t) && Math.abs(t - hora) <= VENTANA_PROBABLE_MS;
  };
  if (!cerca(pago)) return "el pago está a más de 30 minutos de la hora del comprobante";
  const monto = e.leido.monto ?? pago.monto;
  const iguales = e.candidatos.filter((p) => p.estado === "approved" && Math.abs(p.monto - monto) < 0.5 && cerca(p));
  if (new Set([...iguales.map((p) => p.id), pago.id]).size > 1) return "hay varios pagos del mismo monto";
  if (!nombresCoinciden(pago.pagador, e.leido.origen)) return "el nombre del comprobante no coincide con el del pago";
  return null;
}

const centavos = (pesos: number) => Math.round(pesos * 100);

/** ¿Ese monto es la seña o el total del pedido? */
export function cubreDe(pedido: PedidoEsperandoPago, montoCents: number): "SENA" | "TOTAL" | null {
  if (Math.abs(montoCents - pedido.totalCents) < TOLERANCIA_CENTS) return "TOTAL";
  if (pedido.senaCents !== null && pedido.senaCents > 0 && Math.abs(montoCents - pedido.senaCents) < TOLERANCIA_CENTS) return "SENA";
  return null;
}

const MOTIVO_VEREDICTO: Record<Exclude<Veredicto["estado"], "CONFIRMADO" | "PROBABLE" | "NO_ES_COMPROBANTE">, string> = {
  NO_ENCONTRADO: "el pago del comprobante no aparece en Mercado Pago",
  PENDIENTE: "el pago figura en Mercado Pago pero todavía no está acreditado",
  MONTO_DISTINTO: "el monto del comprobante no coincide con el de Mercado Pago",
  SIN_DATOS: "no se pudo leer el monto del comprobante",
};

export function decidirAutoComprobante(e: EntradaAutoComprobante): DecisionAutoComprobante {
  const v = e.veredicto;
  if (v.estado === "NO_ES_COMPROBANTE") return { accion: "SEGUIR" };
  const masNuevo = e.pedidos[0] ?? null;
  if (v.estado !== "CONFIRMADO" && v.estado !== "PROBABLE") return { accion: "A_PERSONA", motivo: MOTIVO_VEREDICTO[v.estado], pedido: masNuevo };
  if (v.pago.estado !== "approved") return { accion: "A_PERSONA", motivo: "el pago no está aprobado en Mercado Pago", pedido: masNuevo };

  const monto = centavos(v.pago.monto);
  const pedido = e.pedidos.find((p) => cubreDe(p, monto) !== null);
  if (!pedido) return { accion: "A_PERSONA", motivo: "el monto pagado no es la seña ni el total del pedido", pedido: masNuevo };
  const cuando = v.pago.fecha ? Date.parse(v.pago.fecha) : NaN;
  if (Number.isNaN(cuando)) return { accion: "A_PERSONA", motivo: "no se pudo leer la fecha del pago en Mercado Pago", pedido };
  if (cuando < pedido.creadoEn.getTime() - MARGEN_ANTERIOR_MS) return { accion: "A_PERSONA", motivo: "el pago es anterior al pedido", pedido };
  if (v.estado === "PROBABLE") {
    const problema = problemaDelProbable(e, v.pago);
    if (problema) return { accion: "A_PERSONA", motivo: problema, pedido };
  }
  if (e.pagoYaUsado) return { accion: "A_PERSONA", motivo: "ese pago de Mercado Pago ya se usó para otro pedido", pedido };
  if (!e.autoConfirmar) return { accion: "A_PERSONA", motivo: "la confirmación automática de pagos está apagada", pedido };
  return { accion: "ACREDITAR", pedido, pago: v.pago, cubre: cubreDe(pedido, monto)! };
}

/** Lo que el bot le contesta al cliente cuando el comprobante lo tiene que mirar una persona. */
export const TEXTO_COMPROBANTE_A_REVISAR = "¡Gracias! Recibí el comprobante, lo estamos chequeando y te confirmo en un ratito 😊";

/** Cuántos archivos de la última tanda del cliente se leen como posible comprobante (cada uno cuesta una lectura). */
export const MAX_ARCHIVOS_COMPROBANTE = 3;

type MensajeLeido = { id: string; direccion: string; tipo: string; media: unknown };

/**
 * Los archivos que pueden ser un comprobante: imágenes o PDF ya bajados de la última tanda de mensajes
 * del cliente (lo que mandó después de la última respuesta), del más nuevo al más viejo.
 * `mensajes` viene del más nuevo al más viejo; las notas del sistema no cortan la tanda.
 */
export function archivosParaComprobante(mensajes: readonly MensajeLeido[]): string[] {
  const ids: string[] = [];
  for (const m of mensajes) {
    if (m.direccion === "SISTEMA") continue;
    if (m.direccion !== "ENTRANTE") break;
    if (m.tipo !== "IMAGEN" && m.tipo !== "DOCUMENTO") continue;
    const a = archivoDeMensaje(m.tipo, m.media);
    if (!a || a.estado !== "LISTO" || !a.mime || !(a.mime.startsWith("image/") || a.mime === "application/pdf")) continue;
    ids.push(m.id);
    if (ids.length >= MAX_ARCHIVOS_COMPROBANTE) break;
  }
  return ids;
}

/** El aviso por Telegram al dueño cuando un comprobante lo tiene que mirar una persona (HTML escapado). */
export function textoAvisoComprobante(p: { nombre: string | null; waId: string; pedido: string | null; motivo: string; veredicto: string }): string {
  const quien = p.nombre ? `${escaparHtml(p.nombre)} (+${escaparHtml(p.waId)})` : `+${escaparHtml(p.waId)}`;
  return [
    "🧾 <b>Comprobante para revisar</b> en el WhatsApp del estudio",
    `De: ${quien}`,
    ...(p.pedido ? [`Pedido: ${escaparHtml(p.pedido)}`] : []),
    `Motivo: ${escaparHtml(p.motivo)}`,
    "",
    escaparHtml(p.veredicto),
    "",
    "Al cliente le dijimos que lo estamos chequeando. El chat quedó en la Bandeja para una persona.",
  ].join("\n");
}
