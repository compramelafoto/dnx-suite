import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { hayTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { aEstado, chatBloqueado } from "./acciones";
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
    const chat = await prisma.fotofficeWaChat.findFirst({ where: { workspaceId, waId }, select: { ultimoEntranteEn: true } });
    return { conectado, ventanaAbierta: chat ? puedeResponderLibre(chat, ahora) : false };
  } catch {
    return { conectado: false, ventanaAbierta: false };
  }
}

export type SalidaAvisoWhatsapp = "ENVIADO" | "FALLO" | "VENTANA_CERRADA" | "SIN_CONEXION";

export async function enviarAvisoPorWhatsapp(
  workspaceId: string,
  waId: string,
  textoCrudo: string,
  deps: { ahora?: Date; enviar?: typeof enviarTexto } = {},
): Promise<SalidaAvisoWhatsapp> {
  const ahora = deps.ahora ?? new Date();
  const texto = truncarSeguro(textoCrudo.trim(), TEXTO_MAXIMO);
  try {
    const conexion = await leerConexion(workspaceId);
    if (conexion.modo !== "REAL") return "SIN_CONEXION";
    const chatId = (await prisma.fotofficeWaChat.findFirst({ where: { workspaceId, waId }, select: { id: true } }))?.id;
    if (!chatId) return "VENTANA_CERRADA";
    const guardado = await prisma.$transaction(async (tx) => {
      const chat = await chatBloqueado(tx, workspaceId, chatId);
      if (!chat || !puedeResponderLibre(aEstado(chat), ahora)) return null;
      const m = await tx.fotofficeWaMensaje.create({
        data: {
          workspaceId, chatId: chat.id, direccion: "SALIENTE", autor: "BOT", autorLabel: "Presupuesto automático",
          tipo: "TEXTO", texto, estadoEnvio: "PENDIENTE", createdAt: ahora,
        },
        select: { id: true },
      });
      await tx.fotofficeWaChat.update({ where: { id: chat.id }, data: { ultimoMensajeEn: ahora, ...vistaPreviaDe(texto, "TEXTO") } });
      return { mensajeId: m.id };
    });
    if (!guardado) return "VENTANA_CERRADA";
    let envio: ResultadoEnvio;
    try {
      envio = await (deps.enviar ?? enviarTexto)(conexion, waId, texto);
    } catch {
      envio = { ok: false, codigo: "INTERNO" };
    }
    const datos: Prisma.FotofficeWaMensajeUpdateInput = !envio.ok
      ? { estadoEnvio: "FALLO", errorCodigo: envio.codigo }
      : envio.simulado
        ? { estadoEnvio: "SIMULADO" }
        : { estadoEnvio: "ENVIADO", waMessageId: envio.waMessageId };
    await prisma.fotofficeWaMensaje.update({ where: { id: guardado.mensajeId }, data: datos }).catch((e) =>
      console.error("[fotoffice][whatsapp] no se pudo guardar el estado del aviso", detalleDeError(e)),
    );
    return envio.ok && !envio.simulado ? "ENVIADO" : "FALLO";
  } catch (e) {
    console.error("[fotoffice][whatsapp] falló el aviso del sistema", detalleDeError(e));
    return "FALLO";
  }
}
