import "server-only";
import { prisma } from "@repo/db";
import { hayTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { aEstado, canalDe, chatBloqueado, enviarPorCanal, guardarResultadoDelEnvio } from "./acciones";
import { leerConexion } from "./conexion";
import { TEXTO_MAXIMO } from "./constantes";
import { enviarTexto, type ResultadoEnvio } from "./envio";
import { detalleDeError } from "./registro";
import { puedeResponderLibre } from "./reglas";
import { truncarSeguro, vistaPreviaDe } from "./vista-previa";

/**
 * Un mensaje que FOTOFFICE le manda a un cliente por WhatsApp sin que nadie lo escriba (el
 * presupuesto aprobado por Telegram, spec 2026-10-25). Sólo sale con la conexión con Meta en modo
 * REAL y con la ventana de 24 h abierta: fuera de la ventana Meta exige plantillas pagas, que no se
 * usan. Queda en el chat de la Bandeja como un mensaje más. Nunca lanza ni loguea el texto o el número.
 */

export type EstadoWhatsappCliente = { conectado: boolean; ventanaAbierta: boolean };

/** ¿Se le puede escribir a ese número ahora? Nunca lanza (ante la duda, no). */
export async function estadoWhatsappDe(workspaceId: string, waId: string | null, ahora: Date): Promise<EstadoWhatsappCliente> {
  try {
    const conexion = await leerConexion(workspaceId);
    const conectado = conexion.modo === "REAL" && conexion.phoneNumberId !== null && (await hayTokenWhatsapp(workspaceId));
    if (!waId) return { conectado, ventanaAbierta: false };
    const chat = await prisma.fotofficeWaChat.findFirst({ where: { workspaceId, canal: "WHATSAPP", waId }, select: { ultimoEntranteEn: true } });
    return { conectado, ventanaAbierta: chat ? puedeResponderLibre(chat, ahora) : false };
  } catch {
    return { conectado: false, ventanaAbierta: false };
  }
}

export type SalidaAvisoWhatsapp = "ENVIADO" | "FALLO" | "VENTANA_CERRADA" | "SIN_CONEXION";

type DepsAviso = { ahora?: Date; enviar?: typeof enviarTexto; autor?: string };

/** El aviso al chat de WhatsApp de ese número (nunca a uno de Instagram con los mismos dígitos). */
export async function enviarAvisoPorWhatsapp(
  workspaceId: string,
  waId: string,
  textoCrudo: string,
  deps: DepsAviso = {},
): Promise<SalidaAvisoWhatsapp> {
  try {
    const conexion = await leerConexion(workspaceId);
    if (conexion.modo !== "REAL") return "SIN_CONEXION";
    const chatId = (await prisma.fotofficeWaChat.findFirst({ where: { workspaceId, canal: "WHATSAPP", waId }, select: { id: true } }))?.id;
    if (!chatId) return "VENTANA_CERRADA";
    return await enviarAvisoAlChat(workspaceId, chatId, textoCrudo, deps);
  } catch (e) {
    console.error("[fotoffice][whatsapp] falló el aviso del sistema", detalleDeError(e));
    return "FALLO";
  }
}

/**
 * El aviso a un chat de la Bandeja, por su canal (WhatsApp o Instagram). Sólo con la conexión en
 * REAL y la ventana de 24 h abierta. Queda en el chat como un mensaje más del BOT.
 */
export async function enviarAvisoAlChat(
  workspaceId: string,
  chatId: string,
  textoCrudo: string,
  deps: DepsAviso = {},
): Promise<SalidaAvisoWhatsapp> {
  const ahora = deps.ahora ?? new Date();
  const texto = truncarSeguro(textoCrudo.trim(), TEXTO_MAXIMO);
  try {
    const conexion = await leerConexion(workspaceId);
    if (conexion.modo !== "REAL") return "SIN_CONEXION";
    const guardado = await prisma.$transaction(async (tx) => {
      const chat = await chatBloqueado(tx, workspaceId, chatId);
      if (!chat || !puedeResponderLibre(aEstado(chat), ahora)) return null;
      // Instagram apagado o sin página: no hay por dónde mandarlo (no se deja un mensaje fallido).
      if (canalDe(chat) === "INSTAGRAM" && !(conexion.igActivo && conexion.igPageId)) return "SIN_CONEXION" as const;
      const m = await tx.fotofficeWaMensaje.create({
        data: {
          workspaceId, chatId: chat.id, direccion: "SALIENTE", autor: "BOT", autorLabel: deps.autor ?? "Cotización automática",
          tipo: "TEXTO", texto, estadoEnvio: "PENDIENTE", createdAt: ahora,
        },
        select: { id: true },
      });
      await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: { ultimoMensajeEn: ahora, ...vistaPreviaDe(texto, "TEXTO") } });
      return { mensajeId: m.id, waId: chat.waId, canal: canalDe(chat) };
    });
    if (!guardado) return "VENTANA_CERRADA";
    if (guardado === "SIN_CONEXION") return "SIN_CONEXION";
    let envio: ResultadoEnvio;
    try {
      envio = await enviarPorCanal(deps.enviar ?? enviarTexto, conexion, guardado.waId, texto, guardado.canal);
    } catch {
      envio = { ok: false, codigo: "INTERNO" };
    }
    await guardarResultadoDelEnvio(guardado.mensajeId, envio, "no se pudo guardar el estado del aviso");
    return envio.ok && !envio.simulado ? "ENVIADO" : "FALLO";
  } catch (e) {
    console.error("[fotoffice][bandeja] falló el aviso del sistema", detalleDeError(e));
    return "FALLO";
  }
}
