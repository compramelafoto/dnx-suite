import "server-only";
import { prisma } from "@repo/db";
import { aEstado, canalDe, chatBloqueado, enviarPorCanal, escribirSistema, guardarResultadoDelEnvio } from "../acciones";
import { leerConexion } from "../conexion";
import { DIRECCIONES_NO_REALES, TEXTO_MAXIMO } from "../constantes";
import { enviarTexto, type ResultadoEnvio } from "../envio";
import { atiendeElBot, puedeResponderLibre } from "../reglas";
import { truncarSeguro, vistaPreviaDe } from "../vista-previa";

/**
 * Lo que el bot escribe en un chat y el paso del chat a una persona. Con el chat bloqueado se
 * revisa que nada haya cambiado mientras el bot pensaba: si entró otro mensaje, si alguien tomó
 * el chat o se cerró la ventana de 24 h, no se envía ("omitido"). La red, fuera de la transacción.
 */

export type DepsEnvioBot = { ahora?: Date; enviar?: typeof enviarTexto };
export type SalidaEnvioBot = "enviado" | "simulado" | "fallo" | "omitido";

export async function enviarComoBot(
  workspaceId: string,
  chatId: string,
  textoCrudo: string,
  condicion: { ultimoMensajeId: string },
  deps: DepsEnvioBot = {},
): Promise<SalidaEnvioBot> {
  const ahora = deps.ahora ?? new Date();
  const texto = truncarSeguro(textoCrudo.trim(), TEXTO_MAXIMO);
  if (!texto) return "omitido";

  const guardado = await prisma.$transaction(async (tx) => {
    const chat = await chatBloqueado(tx, workspaceId, chatId);
    if (!chat) return null;
    const ultimo = await tx.fotofficeWaMensaje.findFirst({
      where: { chatId: chat.id, workspaceId, direccion: { notIn: DIRECCIONES_NO_REALES } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (ultimo?.id !== condicion.ultimoMensajeId) return null;
    const estado = aEstado(chat);
    if (!atiendeElBot(estado, ahora) || !puedeResponderLibre(estado, ahora)) return null;
    const m = await tx.fotofficeWaMensaje.create({
      data: {
        workspaceId, chatId: chat.id, direccion: "SALIENTE", autor: "BOT", autorLabel: "Bot",
        tipo: "TEXTO", texto, estadoEnvio: "PENDIENTE", createdAt: new Date(ahora.getTime() + 1),
      },
      select: { id: true },
    });
    await tx.fotofficeWaChat.update({
      where: { id: chat.id },
      data: { ultimoMensajeEn: new Date(ahora.getTime() + 1), ...vistaPreviaDe(texto, "TEXTO") },
    });
    return { mensajeId: m.id, waId: chat.waId, canal: canalDe(chat) };
  });
  if (!guardado) return "omitido";

  let envio: ResultadoEnvio;
  try {
    envio = await enviarPorCanal(deps.enviar ?? enviarTexto, await leerConexion(workspaceId), guardado.waId, texto, guardado.canal);
  } catch {
    envio = { ok: false, codigo: "INTERNO" };
  }
  await guardarResultadoDelEnvio(guardado.mensajeId, envio, "no se pudo guardar el estado de un mensaje del bot");
  return !envio.ok ? "fallo" : envio.simulado ? "simulado" : "enviado";
}

/** El chat queda para una persona (HUMANO sin asignar: el bot no lo atiende hasta que alguien lo devuelva). */
export async function pasarAPersona(workspaceId: string, chatId: string, motivo: string, ahora: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const chat = await chatBloqueado(tx, workspaceId, chatId);
    if (!chat) return;
    await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: { estado: "HUMANO", asignadoUserId: null, botPausadoHasta: null } });
    await escribirSistema(tx, workspaceId, chat.id, truncarSeguro(`El bot pasó el chat a una persona: ${motivo}`, 300), new Date(ahora.getTime() + 2));
  });
}

/**
 * XV y bodas (spec 2026-11-20): el chat queda ASIGNADO a la persona de ventas (HUMANO con
 * asignado: el bot no lo vuelve a atender y los seguimientos automáticos no salen). El mensaje de
 * sistema dice "pasó el chat a una persona" para que el seguimiento de consulta lo reconozca.
 */
export async function asignarAVentas(
  workspaceId: string,
  chatId: string,
  persona: { userId: number; nombre: string | null },
  motivo: string,
  ahora: Date = new Date(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const chat = await chatBloqueado(tx, workspaceId, chatId);
    if (!chat) return;
    await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: { estado: "HUMANO", asignadoUserId: persona.userId, botPausadoHasta: null } });
    const quien = persona.nombre ? ` (${persona.nombre})` : "";
    await escribirSistema(tx, workspaceId, chat.id, truncarSeguro(`El bot pasó el chat a una persona${quien}: ${motivo}`, 300), new Date(ahora.getTime() + 2));
  });
}
