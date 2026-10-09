import { prisma, type Prisma } from "@repo/db";
import { PAUSA_BOT_HORAS_POR_DEFECTO } from "./constantes";
import { alEco, alEntrante, type EstadoChat, type ParcheChat, type ResultadoRegla } from "./reglas";
import { mismoTelefono } from "./telefono";
import { vistaPreviaDe } from "./vista-previa";
import type { EventoEco, EventoEntrante, EventoEstado, EventoWa } from "./webhook";

/**
 * Registro de la Bandeja de WhatsApp (servidor): aplica los eventos del webhook a chats y mensajes
 * (§3, §4 y §5 del diseño). Idempotente por `waMessageId`: Meta reintenta, y un reintento no
 * vuelve a sumar no leídos ni a aplicar reglas. Nunca loguea textos ni teléfonos.
 */

/** `fallidos`: eventos que fallaron por un error inesperado (el resto del lote se aplicó igual). */
export type ResultadoRegistro = { aplicados: number; duplicados: number; ignorados: number; fallidos: number };

type Db = Prisma.TransactionClient;

/** Estados desde los que se puede avanzar a cada uno: uno posterior no se pisa con uno anterior que llega tarde. */
const ESTADOS_PREVIOS: Record<string, string[]> = {
  ENVIADO: ["PENDIENTE", "SIMULADO"],
  ENTREGADO: ["PENDIENTE", "SIMULADO", "ENVIADO"],
  LEIDO: ["PENDIENTE", "SIMULADO", "ENVIADO", "ENTREGADO"],
};

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

/**
 * Aplica los eventos en orden. Cada evento se aísla: si uno falla por un error inesperado se lo
 * cuenta en `fallidos` (y se loguea índice y tipo, nada personal) y el resto del lote sigue. Quien
 * llama debe responder 500 si hay fallidos: Meta reintenta y lo ya aplicado es idempotente.
 */
export async function aplicarEventos(
  eventos: EventoWa[],
  ahora: Date = new Date(),
  /** `workspaceId`: sólo para el simulador de Configuración. Resuelve la conexión por institución en vez de por `phoneNumberId`. */
  opciones: { workspaceId?: string } = {},
): Promise<ResultadoRegistro> {
  const r: ResultadoRegistro = { aplicados: 0, duplicados: 0, ignorados: 0, fallidos: 0 };
  const conexiones = new Map<string, { workspaceId: string; pausaBotHoras: number } | null>();

  for (const [indice, ev] of eventos.entries()) {
    try {
      const clave = opciones.workspaceId ?? ev.phoneNumberId;
      let conexion = conexiones.get(clave);
      if (conexion === undefined) {
        const c = await prisma.fotofficeWaConexion.findUnique({
          where: opciones.workspaceId ? { workspaceId: opciones.workspaceId } : { phoneNumberId: ev.phoneNumberId },
          select: { workspaceId: true, pausaBotHoras: true },
        });
        conexion = c ? { workspaceId: c.workspaceId, pausaBotHoras: c.pausaBotHoras ?? PAUSA_BOT_HORAS_POR_DEFECTO } : null;
        conexiones.set(clave, conexion);
      }
      if (!conexion) {
        r.ignorados++;
        continue;
      }
      if (ev.tipo === "ESTADO") {
        if (await aplicarEstado(conexion.workspaceId, ev)) r.aplicados++;
        else r.ignorados++;
        continue;
      }
      const salida = await registrarMensaje(conexion.workspaceId, conexion.pausaBotHoras, ev, ahora);
      if (salida === "duplicado") r.duplicados++;
      else r.aplicados++;
    } catch (error) {
      r.fallidos++;
      console.error("[fotoffice][whatsapp] falló un evento del lote", { indice, tipo: ev.tipo, ...detalleDeError(error) });
    }
  }
  return r;
}

/** Del error, sólo el nombre y el código de Prisma: el mensaje puede traer textos o teléfonos. */
export function detalleDeError(error: unknown): { error: string; codigo?: string } {
  const codigo = (error as { code?: unknown } | null)?.code;
  return {
    error: error instanceof Error ? error.name : "desconocido",
    ...(typeof codigo === "string" ? { codigo } : {}),
  };
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

  const clave = { workspaceId_waId: { workspaceId, waId: ev.waId } };
  let chat = await tx.fotofficeWaChat.findUnique({ where: clave });
  if (chat) {
    // Candado de fila: un "Tomar" simultáneo del panel espera a que terminemos (o lo esperamos), y
    // volvemos a leer el chat ya con sus cambios antes de calcular el parche de las reglas.
    await tx.$executeRaw`SELECT 1 FROM "FotofficeWaChat" WHERE id = ${chat.id} FOR UPDATE`;
    chat = (await tx.fotofficeWaChat.findUnique({ where: clave })) ?? chat;
  } else {
    chat = await tx.fotofficeWaChat.create({
      data: {
        workspaceId, waId: ev.waId, nombre: entrante ? ev.nombre : null, ultimoMensajeEn: cuando, ...vistaPreviaDe(ev.texto, ev.mensajeTipo),
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
  // `noLeidos` se suma en la base (increment), no se lee-y-escribe.
  // Un mensaje viejo (reintento tardío) no retrocede las horas del chat.
  if (parche.ultimoEntranteEn && chat.ultimoEntranteEn && chat.ultimoEntranteEn.getTime() > parche.ultimoEntranteEn.getTime()) {
    parche.ultimoEntranteEn = chat.ultimoEntranteEn;
  }
  if (cuando.getTime() > chat.ultimoMensajeEn.getTime()) {
    parche.ultimoMensajeEn = cuando;
    Object.assign(parche, vistaPreviaDe(ev.texto, ev.mensajeTipo));
  }
  if (entrante) {
    parche.noLeidos = { increment: 1 };
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

/**
 * Estado de envío de un mensaje nuestro. `false` si no lo conocemos o el estado no avanza. El
 * `where` del `updateMany` exige que el estado actual sea de rango menor: dos avisos simultáneos
 * (entregado y leído) no pueden retroceder el resultado. FALLO es terminal y sólo vale antes de la entrega.
 */
async function aplicarEstado(workspaceId: string, ev: EventoEstado): Promise<boolean> {
  const m = await prisma.fotofficeWaMensaje.findUnique({
    where: { workspaceId_waMessageId: { workspaceId, waMessageId: ev.waMessageId } },
    select: { id: true, direccion: true },
  });
  if (!m) {
    // Aviso de estado sin mensaje: puede ser que el envío no haya guardado todavía su waMessageId.
    console.warn("[fotoffice][whatsapp] estado de un mensaje desconocido", { estado: ev.estado, codigo: ev.errorCodigo });
    return false;
  }
  if (m.direccion !== "SALIENTE") return false;
  const previos = (ev.estado === "FALLO" ? ["PENDIENTE", "SIMULADO", "ENVIADO"] : ESTADOS_PREVIOS[ev.estado]) as string[];
  const r = await prisma.fotofficeWaMensaje.updateMany({
    where: { id: m.id, estadoEnvio: { in: previos } },
    data: { estadoEnvio: ev.estado, errorCodigo: ev.estado === "FALLO" ? ev.errorCodigo : null },
  });
  return r.count > 0;
}
