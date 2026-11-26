import "server-only";
import { prisma } from "@repo/db";
import { anuncioDeMedia } from "../anuncio";
import { escribirSistema } from "../acciones";
import { atiendeElBot, type EstadoChat } from "../reglas";
import { enviarComoBot, type SalidaEnvioBot } from "./envio-bot";
import { LIMITE_HORAS } from "./recordatorio-pago";
import {
  consultaDeAnuncioSinRespuesta,
  cualRecordatorio,
  marcaRecordatorioAnuncio,
  PRIMERO_DESDE_HORAS,
  textoRecordatorioAnuncio,
  type MensajeParaRecordar,
} from "./recordatorio-anuncio";
import { MARCA_SEGUIMIENTO_CONSULTA } from "./seguimiento-consulta";

/**
 * Recordatorios a las consultas de anuncios de VHS y XV sin respuesta (ver `recordatorio-anuncio.ts`).
 * Lo corre el cron del bot cada 15 minutos. Sólo chats que atiende el bot, con el bot encendido, y
 * sólo si la charla terminó con un mensaje del bot (el envío lo vuelve a comprobar con `ultimoMensajeId`).
 */

const HORA_MS = 3_600_000;

type ChatCandidato = EstadoChat & { id: string; workspaceId: string; nombre: string | null };

export type DepsRecordatorioAnuncio = {
  ahora?: Date;
  botActivo?: (workspaceId: string) => Promise<boolean>;
  candidatos?: (ahora: Date) => Promise<ChatCandidato[]>;
  charla?: (chat: ChatCandidato) => Promise<(MensajeParaRecordar & { id: string })[]>;
  enviar?: (workspaceId: string, chatId: string, texto: string, condicion: { ultimoMensajeId: string }) => Promise<SalidaEnvioBot>;
  marcar?: (workspaceId: string, chatId: string, texto: string) => Promise<void>;
};

const POR_OMISION: Required<Omit<DepsRecordatorioAnuncio, "ahora">> = {
  botActivo: async (workspaceId) => {
    const [{ leerConfigBot }, { botEncendido }] = await Promise.all([import("@/lib/dnx-bot/config"), import("./interruptor")]);
    const cfg = leerConfigBot();
    return cfg.enabled && Boolean(cfg.anthropicApiKey) && (await botEncendido(workspaceId));
  },
  candidatos: async (ahora) => {
    const chats = await prisma.fotofficeWaChat.findMany({
      where: {
        estado: "BOT",
        canal: "WHATSAPP",
        ultimoEntranteEn: { gte: new Date(ahora.getTime() - LIMITE_HORAS * HORA_MS), lte: new Date(ahora.getTime() - PRIMERO_DESDE_HORAS * HORA_MS) },
        createdAt: { gte: new Date(ahora.getTime() - 2 * 24 * HORA_MS) },
      },
      select: { id: true, workspaceId: true, nombre: true, estado: true, asignadoUserId: true, botPausadoHasta: true, botExcluido: true, ultimoEntranteEn: true },
      take: 300,
    });
    return chats.map((c) => ({ ...c, estado: c.estado as EstadoChat["estado"] }));
  },
  charla: (chat) =>
    prisma.fotofficeWaMensaje.findMany({
      where: { workspaceId: chat.workspaceId, chatId: chat.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, direccion: true, autor: true, texto: true, media: true, createdAt: true },
      take: 60,
    }),
  enviar: (workspaceId, chatId, texto, condicion) => enviarComoBot(workspaceId, chatId, texto, condicion),
  marcar: (workspaceId, chatId, texto) => prisma.$transaction((tx) => escribirSistema(tx, workspaceId, chatId, texto, new Date())),
};

export async function recordarConsultasDeAnuncio(deps: DepsRecordatorioAnuncio = {}): Promise<{ revisados: number; enviados: number }> {
  const d = { ...POR_OMISION, ...deps };
  const ahora = deps.ahora ?? new Date();
  const activo = new Map<string, boolean>();
  let revisados = 0;
  let enviados = 0;
  for (const chat of await d.candidatos(ahora)) {
    revisados++;
    try {
      if (!atiendeElBot(chat, ahora)) continue;
      const charla = await d.charla(chat);
      const consulta = consultaDeAnuncioSinRespuesta(charla, anuncioDeMedia, [MARCA_SEGUIMIENTO_CONSULTA]);
      if (!consulta) continue;
      const n = cualRecordatorio(chat.ultimoEntranteEn, ahora, consulta.ya);
      if (!n) continue;
      const ultimo = [...charla].reverse().find((m) => m.direccion !== "SISTEMA" && m.direccion !== "NOTA");
      if (!ultimo || ultimo.direccion !== "SALIENTE") continue;
      if (!activo.has(chat.workspaceId)) activo.set(chat.workspaceId, await d.botActivo(chat.workspaceId));
      if (!activo.get(chat.workspaceId)) continue;
      const salida = await d.enviar(chat.workspaceId, chat.id, textoRecordatorioAnuncio(consulta.tema, n, chat.nombre, chat.id), { ultimoMensajeId: ultimo.id });
      if (salida === "omitido") continue;
      // También si falló: queda a la vista en el chat y no se insiste.
      await d.marcar(chat.workspaceId, chat.id, marcaRecordatorioAnuncio(n));
      if (salida !== "fallo") enviados++;
    } catch (e) {
      console.warn("[fotoffice][whatsapp] falló un recordatorio de anuncio", { codigo: (e as { code?: string } | null)?.code ?? (e instanceof Error ? e.name : "desconocido") });
    }
  }
  return { revisados, enviados };
}
