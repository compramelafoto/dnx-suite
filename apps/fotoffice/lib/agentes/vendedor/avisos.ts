import "server-only";
import { prisma } from "@repo/db";
import type { DeliveryMetricField, ParsedWebhookEvent } from "@/lib/mailing/webhook-events";
import { mandarMensaje, type DepsTelegramApi } from "@/lib/telegram/api";
import { agregarNota, cambiarEstado } from "../buscador/contactos";
import { destinoAgentes } from "../canal";
import { guardarAjustesVendedor, leerAjustesVendedor } from "./ajustes";
import { mensajePausa } from "./mensajes";
import { AUTOR_VENDEDOR, type PasoSalida } from "./tipos";

/**
 * Avisos de Resend (entregado, abierto, clic, rebote, queja) sobre los correos del Vendedor, y el
 * freno por salud de la dirección: con muchos rebotes o alguna queja el Vendedor se pausa solo.
 *
 * El webhook de estados es compartido con los correos a socios: acá sólo llegan los avisos que
 * ninguna campaña reconoció.
 */

/** Cuántos envíos recientes mira la salud de la dirección. */
export const VENTANA_SALUD = 50;
/** Rebotes tolerados en la ventana: 3 o más (más del 5 % de 50) frenan. */
export const MAX_REBOTES_SALUD = 2;

/** Los pasos que hablan de la salud de la dirección: los reenvíos a Daniel no cuentan. */
const PASOS_SALUD: readonly PasoSalida[] = ["PRIMERO", "RECORDATORIO", "RESPUESTA"];

const COLUMNA = {
  deliveredAt: "entregadoEn",
  openedAt: "abiertoEn",
  clickedAt: "clicEn",
  bouncedAt: "reboteEn",
  complainedAt: "quejaEn",
} as const satisfies Record<DeliveryMetricField, string>;

export async function aplicarAvisoVendedor(
  e: ParsedWebhookEvent,
  ahora: Date,
  deps: DepsTelegramApi = {},
): Promise<"APLICADO" | "DUPLICADO" | "DESCONOCIDO"> {
  const columna = COLUMNA[e.field];
  const correo = await prisma.dnxVendedorCorreo.findUnique({
    where: { resendId: e.emailId },
    select: { id: true, hiloId: true, contactoId: true, para: true, entregadoEn: true, abiertoEn: true, clicEn: true, reboteEn: true, quejaEn: true },
  });
  if (!correo) return "DESCONOCIDO";
  const rebote = e.field === "bouncedAt";
  const queja = e.field === "complainedAt";

  // El primer aviso de cada tipo gana. Un reintento del rebote o la queja sólo vuelve a mirar la salud.
  if (correo[columna] !== null) {
    if (rebote || queja) await revisarSalud(ahora, deps);
    return "DUPLICADO";
  }

  // Primero las consecuencias y después la columna: si algo falla, Resend reintenta y se rehace.
  if (rebote) {
    if (correo.hiloId) {
      await prisma.dnxVendedorHilo.updateMany({
        where: { id: correo.hiloId, estado: { notIn: ["CERRADO", "BAJA"] } },
        data: { estado: "CERRADO", cierre: "REBOTE" },
      });
    }
    if (correo.contactoId) await agregarNota(correo.contactoId, `El email ${correo.para} rebotó: no es válido.`, AUTOR_VENDEDOR);
  }
  if (queja) {
    if (correo.contactoId) {
      const r = await cambiarEstado(correo.contactoId, "NO_CONTACTAR", AUTOR_VENDEDOR);
      if (!r.ok) throw new Error(`Vendedor: no se pudo pasar a NO_CONTACTAR (${r.motivo ?? "sin motivo"})`);
    }
    if (correo.hiloId) {
      await prisma.dnxVendedorHilo.updateMany({
        where: { id: correo.hiloId, estado: { not: "BAJA" } },
        data: { estado: "BAJA", cierre: "QUEJA" },
      });
    }
  }

  const r = await prisma.dnxVendedorCorreo.updateMany({ where: { id: correo.id, [columna]: null }, data: { [columna]: e.at } });
  if (rebote || queja) await revisarSalud(ahora, deps);
  return r.count === 1 ? "APLICADO" : "DUPLICADO";
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * Mira los últimos 50 envíos (desde `saludDesde`, que se mueve al reanudar) y, con 3 rebotes o una
 * queja, pausa el Vendedor y avisa a Daniel. Si ya estaba pausado no hace nada más: avisa una sola vez.
 */
export async function revisarSalud(_ahora: Date, deps: DepsTelegramApi = {}): Promise<{ frenado: boolean }> {
  const ajustes = await leerAjustesVendedor();
  const desde = ajustes.saludDesde ? new Date(ajustes.saludDesde) : null;
  const ultimos = await prisma.dnxVendedorCorreo.findMany({
    where: {
      direccion: "SALIDA",
      paso: { in: [...PASOS_SALUD] },
      ...(desde && !Number.isNaN(desde.getTime()) ? { creadoEn: { gte: desde } } : {}),
    },
    orderBy: { creadoEn: "desc" },
    take: VENTANA_SALUD,
    select: { reboteEn: true, quejaEn: true },
  });
  const rebotes = ultimos.filter((c) => c.reboteEn !== null).length;
  const quejas = ultimos.filter((c) => c.quejaEn !== null).length;
  const frenado = rebotes > MAX_REBOTES_SALUD || quejas > 0;
  if (!frenado || ajustes.pausado) return { frenado };

  await guardarAjustesVendedor({ pausado: true, pausadoPor: "SALUD" });
  const detalle = `En los últimos ${plural(ultimos.length, "envío", "envíos")} hubo ${plural(rebotes, "rebote", "rebotes")} y ${plural(quejas, "queja de spam", "quejas de spam")}.`;
  try {
    const destino = await destinoAgentes();
    if (destino) await mandarMensaje(destino.token, destino.chatId, mensajePausa("SALUD", detalle), null, deps);
    else console.error("[agentes][vendedor] pausado por salud, pero no hay chat de Telegram vinculado");
  } catch {
    // La pausa ya quedó: que no llegue el aviso no la deshace.
    console.error("[agentes][vendedor] pausado por salud, pero no se pudo avisar por Telegram");
  }
  return { frenado };
}
