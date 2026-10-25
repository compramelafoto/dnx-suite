import "server-only";
import { BotTurnError, costMicroUsd, runBotTurn, type BotTurnInput, type BotTurnResult, type BotUsage } from "@repo/dnx-bot";
import { prisma } from "@repo/db";
import { clienteAnthropic } from "@/lib/dnx-bot/anthropic";
import { cifrasNoRespaldadas, cifrasPermitidas, textosDelTurno } from "@/lib/dnx-bot/cifras";
import { leerConfigBot, plataformaDe, type BotConfigFotoffice } from "@/lib/dnx-bot/config";
import { reportarIncidente } from "@/lib/dnx-bot/incidentes";
import { decidirLimites } from "@/lib/dnx-bot/limites";
import type { enviarTexto } from "../envio";
import { atiendeElBot, puedeResponderLibre } from "../reglas";
import { enviarComoBot, pasarAPersona } from "./envio-bot";
import { guiaDeAtencion, situacionDeAtencion } from "./guia";
import { herramientasDeAtencion, type DepsAtencion } from "./herramientas";
import { historialParaElBot } from "./historial";
import { botEncendido } from "./interruptor";
import { registrarUsoWa, usoWa } from "./uso";

/**
 * Un turno del bot en un chat de la Bandeja (etapa 3a). Lo dispara `after()` cuando entra un
 * mensaje a un chat que atiende el bot. Espera unos segundos por si el cliente sigue escribiendo:
 * si entró otro mensaje, no hace nada (lo contesta la ejecución de ese mensaje). Cualquier falla
 * termina igual: el cliente recibe `TEXTO_SI_FALLA` y el chat pasa a una persona. Nunca lanza.
 */

export const TEXTO_SI_FALLA = "Gracias por escribir. En un rato te responde alguien del estudio.";
export const ESPERA_MS = 4_000;
export const MAX_RESPUESTAS_POR_DIA = 30;
const MAX_VUELTAS = 6;
const TIEMPO_MAXIMO_MS = 60_000;

export type DepsResponder = {
  ahora?: () => Date;
  esperar?: (ms: number) => Promise<void>;
  config?: () => BotConfigFotoffice;
  turno?: (i: BotTurnInput) => Promise<BotTurnResult>;
  enviar?: typeof enviarTexto;
  herramientas?: Partial<DepsAtencion>;
};

export type SalidaBot = "respondio" | "derivo" | "nada";

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function ultimoMensaje(chatId: string) {
  return prisma.fotofficeWaMensaje.findFirst({
    where: { chatId, direccion: { not: "SISTEMA" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, direccion: true },
  });
}

/** El texto final del modelo: el último mensaje del asistente (sin lo que dijo entre herramientas). */
function textoFinal(appended: BotTurnResult["appended"]): string {
  const ultimo = [...appended].reverse().find((m) => m.role === "assistant");
  if (!ultimo) return "";
  if (typeof ultimo.content === "string") return ultimo.content.trim();
  if (!Array.isArray(ultimo.content)) return "";
  return (ultimo.content as { type?: string; text?: string }[])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function responderConBot(chatId: string, deps: DepsResponder = {}): Promise<SalidaBot> {
  try {
    return await turno(chatId, deps);
  } catch (e) {
    console.error("[fotoffice][whatsapp] el bot falló sin poder avisar", e instanceof Error ? e.name : "desconocido");
    return "nada";
  }
}

async function turno(chatId: string, deps: DepsResponder): Promise<SalidaBot> {
  const ahora = deps.ahora ?? (() => new Date());
  const cfg = (deps.config ?? leerConfigBot)();
  if (!cfg.enabled || !cfg.anthropicApiKey) return "nada";

  const chat = await prisma.fotofficeWaChat.findUnique({
    where: { id: chatId },
    select: { id: true, workspaceId: true, estado: true, asignadoUserId: true, botPausadoHasta: true, ultimoEntranteEn: true, nombre: true },
  });
  if (!chat) return "nada";
  const workspaceId = chat.workspaceId;
  const estado = { ...chat, estado: chat.estado as "BOT" | "HUMANO" | "RESUELTO" };
  if (!atiendeElBot(estado, ahora()) || !puedeResponderLibre(estado, ahora())) return "nada";
  if (!(await botEncendido(workspaceId))) return "nada";

  const antes = await ultimoMensaje(chatId);
  if (!antes || antes.direccion !== "ENTRANTE") return "nada";
  await (deps.esperar ?? dormir)(ESPERA_MS);
  const despues = await ultimoMensaje(chatId);
  if (despues?.id !== antes.id) return "nada";

  const leidos = await prisma.fotofficeWaMensaje.findMany({
    where: { chatId, workspaceId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { direccion: true, autor: true, tipo: true, texto: true },
  });
  const h = historialParaElBot(leidos.reverse());
  if (!h) return "nada";

  const plataforma = plataformaDe(workspaceId);
  const ultimoMensajeId = antes.id;
  const incidente = (codigo: string, detalle: string) =>
    reportarIncidente({ plataforma, area: "whatsapp", codigo, ids: { chatId }, detalle, urgente: false }).catch(() => undefined);
  const fallar = async (codigo: string, detalle: string): Promise<SalidaBot> => {
    await incidente(codigo, detalle);
    const salida = await enviarComoBot(workspaceId, chatId, TEXTO_SI_FALLA, { ultimoMensajeId }, { ahora: ahora(), enviar: deps.enviar });
    if (salida === "omitido") return "nada";
    await pasarAPersona(workspaceId, chatId, "el bot no pudo responder", ahora());
    return "derivo";
  };
  const cobrar = (usage: BotUsage, contarMensaje: boolean) =>
    registrarUsoWa({ plataforma, chatId, usage, costMicroUsd: costMicroUsd(cfg.model, usage), contarMensaje, ahora: ahora() }).catch((e) =>
      console.error("[fotoffice][whatsapp] no se pudo registrar el uso del bot", e instanceof Error ? e.name : "desconocido"),
    );

  const limites = decidirLimites({ ...cfg.limits, maxMessagesPerUserPerDay: MAX_RESPUESTAS_POR_DIA }, await usoWa({ plataforma, chatId, ahora: ahora() }));
  if (!limites.permitido) return fallar(`tope_${limites.motivo}`, limites.motivo);

  const estudio = await prisma.fotofficeWorkspaceBranding
    .findUnique({ where: { workspaceId }, select: { commercialName: true } })
    .then((b) => b?.commercialName ?? "el estudio")
    .catch(() => "el estudio");
  const { tools, pedidoDePersona } = herramientasDeAtencion(workspaceId, deps.herramientas);

  let result: BotTurnResult;
  try {
    result = await (deps.turno ?? runBotTurn)({
      client: clienteAnthropic(),
      model: cfg.model,
      effort: cfg.effort,
      systemGuide: guiaDeAtencion(),
      situation: situacionDeAtencion({ estudio, cliente: chat.nombre, ahora: ahora() }),
      tools,
      actor: { userId: 0, role: "CLIENTE_WHATSAPP", email: "", name: chat.nombre },
      history: h.history,
      userText: h.userText,
      maxIterations: Math.min(cfg.maxIterations, MAX_VUELTAS),
      deadlineMs: Date.now() + TIEMPO_MAXIMO_MS,
      onText: () => undefined,
      proposeWrite: async () => {
        throw new Error("El bot de WhatsApp no tiene herramientas de escritura");
      },
      onProposal: () => undefined,
    });
  } catch (e) {
    if (e instanceof BotTurnError) await cobrar(e.usage, false);
    const causa = e instanceof BotTurnError ? e.cause : e;
    return fallar(`api_${causa instanceof Error ? causa.name : "error"}`, causa instanceof Error ? causa.message : String(causa));
  }
  await cobrar(result.usage, true);

  const texto = textoFinal(result.appended);
  if (result.outcome !== "ok" || !texto) return fallar(`turno_${result.outcome}`, result.outcome);

  const sueltas = cifrasNoRespaldadas(texto, cifrasPermitidas(textosDelTurno([...h.history, ...result.appended])));
  if (sueltas.length > 0) return fallar("cifra_no_respaldada", sueltas.join(", "));

  const salida = await enviarComoBot(workspaceId, chatId, texto, { ultimoMensajeId }, { ahora: ahora(), enviar: deps.enviar });
  if (salida === "omitido") return "nada";
  if (salida === "fallo") await incidente("envio_fallo", "Meta rechazó el mensaje del bot");
  const motivo = pedidoDePersona();
  if (motivo) {
    await pasarAPersona(workspaceId, chatId, motivo, ahora());
    return "derivo";
  }
  return "respondio";
}
