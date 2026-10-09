import { prisma, type Prisma } from "@repo/db";
import { PAUSA_BOT_HORAS_POR_DEFECTO, type EstadoEnvio } from "./constantes";
import { alEco, alEntrante, type EstadoChat, type ParcheChat, type ResultadoRegla } from "./reglas";
import { mismoTelefono } from "./telefono";
import type { EventoEco, EventoEntrante, EventoEstado, EventoWa } from "./webhook";

/**
 * Registro de la Bandeja de WhatsApp (servidor): aplica los eventos del webhook a chats y mensajes
 * (§3, §4 y §5 del diseño). Idempotente por `waMessageId`: Meta reintenta, y un reintento no
 * vuelve a sumar no leídos ni a aplicar reglas. Nunca loguea textos ni teléfonos.
 */

export type ResultadoRegistro = { aplicados: number; duplicados: number; ignorados: number };

type Db = Prisma.TransactionClient;

/** Orden de los estados de envío: uno posterior no se pisa con uno anterior que llega tarde. */
const RANGO: Record<string, number> = { PENDIENTE: 0, SIMULADO: 0, ENVIADO: 1, ENTREGADO: 2, LEIDO: 3 };

const esChoqueDeUnico = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

/**
 * Cliente del workspace con ese teléfono (§4). Se vincula sólo si hay EXACTAMENTE uno; con varios
 * o ninguno devuelve `null` y el panel ofrece vincular a mano.
 */
export async function clienteDelTelefono(workspaceId: string, waId: string, db: Pick<Db, "client"> = prisma): Promise<string | null> {
  const fichas = await db.client.findMany({ where: { workspaceId, phone: { not: null } }, select: { id: true, phone: true } });
  const coinciden = fichas.filter((f) => mismoTelefono(waId, f.phone));
  return coinciden.length === 1 ? coinciden[0].id : null;
}

/** Aplica los eventos en orden. Un error inesperado de base se propaga (el webhook responde 500 y Meta reintenta). */
export async function aplicarEventos(eventos: EventoWa[], ahora: Date = new Date()): Promise<ResultadoRegistro> {
  const r: ResultadoRegistro = { aplicados: 0, duplicados: 0, ignorados: 0 };
  const conexiones = new Map<string, { workspaceId: string; pausaBotHoras: number } | null>();

  for (const ev of eventos) {
    let conexion = conexiones.get(ev.phoneNumberId);
    if (conexion === undefined) {
      const c = await prisma.fotofficeWaConexion.findUnique({
        where: { phoneNumberId: ev.phoneNumberId },
        select: { workspaceId: true, pausaBotHoras: true },
      });
      conexion = c ? { workspaceId: c.workspaceId, pausaBotHoras: c.pausaBotHoras ?? PAUSA_BOT_HORAS_POR_DEFECTO } : null;
      conexiones.set(ev.phoneNumberId, conexion);
    }
    if (!conexion) {
      r.ignorados++;
      continue;
    }
    if (ev.tipo === "ESTADO") {
      (await aplicarEstado(conexion.workspaceId, ev)) ? r.aplicados++ : r.ignorados++;
      continue;
    }
    const salida = await registrarMensaje(conexion.workspaceId, conexion.pausaBotHoras, ev, ahora);
    if (salida === "duplicado") r.duplicados++;
    else r.aplicados++;
  }
  return r;
}

async function registrarMensaje(
  workspaceId: string,
  pausaBotHoras: number,
  ev: EventoEntrante | EventoEco,
  ahora: Date,
): Promise<"aplicado" | "duplicado"> {
  const existe = () =>
    prisma.fotofficeWaMensaje.findUnique({ where: { workspaceId_waMessageId: { workspaceId, waMessageId: ev.waMessageId } }, select: { id: true } });
  if (await existe()) return "duplicado";

  // Dos intentos: el choque de único puede ser el mensaje (reintento simultáneo de Meta: ya está,
  // no se reaplica nada) o la creación simultánea del chat (la segunda vuelta ya lo encuentra).
  for (let intento = 0; ; intento++) {
    try {
      await prisma.$transaction((tx) => escribir(tx, workspaceId, pausaBotHoras, ev, ahora));
      return "aplicado";
    } catch (e) {
      if (!esChoqueDeUnico(e)) throw e;
      if (await existe()) return "duplicado";
      if (intento >= 1) throw e;
    }
  }
}

async function escribir(tx: Db, workspaceId: string, pausaBotHoras: number, ev: EventoEntrante | EventoEco, ahora: Date) {
  // La hora del hecho, sin pasar de la de recepción (un reloj adelantado no debe fijar una pausa eterna).
  const cuando = ev.en && ev.en.getTime() < ahora.getTime() ? ev.en : ahora;
  const entrante = ev.tipo === "ENTRANTE";

  let chat = await tx.fotofficeWaChat.findUnique({ where: { workspaceId_waId: { workspaceId, waId: ev.waId } } });
  if (!chat) {
    chat = await tx.fotofficeWaChat.create({
      data: {
        workspaceId, waId: ev.waId, nombre: entrante ? ev.nombre : null, ultimoMensajeEn: cuando,
        clientId: await clienteDelTelefono(workspaceId, ev.waId, tx),
      },
    });
  }

  await tx.fotofficeWaMensaje.create({
    data: {
      workspaceId, chatId: chat.id, waMessageId: ev.waMessageId, createdAt: cuando,
      direccion: entrante ? "ENTRANTE" : "SALIENTE",
      autor: entrante ? "CLIENTE" : "CELULAR",
      estadoEnvio: entrante ? "RECIBIDO" : "ENVIADO",
      tipo: ev.mensajeTipo, texto: ev.texto,
      ...(ev.media ? { media: ev.media as Prisma.InputJsonObject } : {}),
    },
  });

  const estado: EstadoChat = {
    estado: chat.estado as EstadoChat["estado"],
    asignadoUserId: chat.asignadoUserId,
    botPausadoHasta: chat.botPausadoHasta,
    ultimoEntranteEn: chat.ultimoEntranteEn,
  };
  const regla: ResultadoRegla = entrante ? alEntrante(estado, cuando) : alEco(estado, cuando, ev.texto, pausaBotHoras);

  const parche: ParcheChat & Record<string, unknown> = { ...regla.parche };
  // Un mensaje viejo (reintento tardío) no retrocede las horas del chat.
  if (parche.ultimoEntranteEn && chat.ultimoEntranteEn && chat.ultimoEntranteEn.getTime() > parche.ultimoEntranteEn.getTime()) {
    parche.ultimoEntranteEn = chat.ultimoEntranteEn;
  }
  if (cuando.getTime() > chat.ultimoMensajeEn.getTime()) parche.ultimoMensajeEn = cuando;
  if (entrante) {
    parche.noLeidos = chat.noLeidos + 1;
    if (ev.nombre && ev.nombre !== chat.nombre) parche.nombre = ev.nombre;
  }
  if (!chat.clientId) {
    const clientId = await clienteDelTelefono(workspaceId, ev.waId, tx);
    if (clientId) parche.clientId = clientId;
  }
  await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: parche });

  if (regla.sistema) {
    await tx.fotofficeWaMensaje.create({
      data: {
        workspaceId, chatId: chat.id, direccion: "SISTEMA", autor: "SISTEMA", tipo: "TEXTO",
        texto: regla.sistema.texto, createdAt: new Date(cuando.getTime() + 1),
      },
    });
  }
}

/** Estado de envío de un mensaje nuestro. `false` si no lo conocemos o el estado ya era posterior. */
async function aplicarEstado(workspaceId: string, ev: EventoEstado): Promise<boolean> {
  const m = await prisma.fotofficeWaMensaje.findUnique({
    where: { workspaceId_waMessageId: { workspaceId, waMessageId: ev.waMessageId } },
    select: { id: true, direccion: true, estadoEnvio: true },
  });
  if (!m || m.direccion !== "SALIENTE") return false;
  const actual: EstadoEnvio = m.estadoEnvio as EstadoEnvio;
  const rangoActual = RANGO[actual] ?? 0;
  // Un fallo sólo vale si el mensaje no llegó a entregarse; el resto, sólo si avanza.
  const avanza = ev.estado === "FALLO" ? rangoActual < 2 : (RANGO[ev.estado] ?? 0) > rangoActual;
  if (!avanza || actual === ev.estado) return false;
  await prisma.fotofficeWaMensaje.update({
    where: { id: m.id },
    data: { estadoEnvio: ev.estado, errorCodigo: ev.estado === "FALLO" ? ev.errorCodigo : null },
  });
  return true;
}
