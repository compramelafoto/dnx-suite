import "server-only";
import { Anthropic, costMicroUsd, type TokenUsage } from "@repo/dnx-bot";
import { prisma } from "@repo/db";
import { clienteAnthropic } from "@/lib/dnx-bot/anthropic";
import { leerConfigBot, plataformaDe } from "@/lib/dnx-bot/config";
import { decidirLimites } from "@/lib/dnx-bot/limites";
import { registrarUsoWa, usoWa } from "./bot/uso";
import { detalleDeError } from "./registro";
import { truncarSeguro } from "./vista-previa";

/**
 * Resumen de una conversación de la Bandeja (§6.4 del diseño 2026-11-24): de 3 a 5 líneas con qué
 * pide el cliente, qué se le respondió, qué falta y los montos o fechas. Lo arma Claude con el mismo
 * modelo y tope de gasto que el bot. Se guarda en el chat (`resumen`, `resumenEn`). NUNCA lanza:
 * si algo falla o se agotó el tope, devuelve `null` y no cambia nada.
 */

export const RESUMEN_MAXIMO = 800;
const MENSAJES_DEL_RESUMEN = 40;

const INSTRUCCIONES = [
  "Sos parte del equipo de un estudio de fotografía. Resumí la charla de WhatsApp para que otra persona del equipo la retome sin leerla.",
  "Escribí en castellano rioplatense, de 3 a 5 líneas cortas, sin saludos ni títulos:",
  "qué pide el cliente; qué se le respondió u ofreció; qué falta o qué espera; montos, fechas y cantidades mencionados.",
  "Las notas internas son del equipo: usalas como contexto. Si algo no está claro, no lo inventes.",
].join("\n");

type Config = { enabled: boolean; anthropicApiKey: string | null; model: string; limits: ReturnType<typeof leerConfigBot>["limits"] };
type Deps = {
  ahora?: Date;
  config?: () => Config;
  uso?: typeof usoWa;
  registrarUso?: typeof registrarUsoWa;
  llamar?: (charla: string, cfg: Config) => Promise<{ texto: string; usage: TokenUsage }>;
};

async function llamarAClaude(charla: string, cfg: Config): Promise<{ texto: string; usage: TokenUsage }> {
  const cliente = clienteAnthropic() as unknown as Anthropic;
  const r = await cliente.messages.create({ model: cfg.model, max_tokens: 400, system: INSTRUCCIONES, messages: [{ role: "user", content: charla }] });
  const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  return { texto, usage: { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens } };
}

type Fila = { direccion: string; autor: string; autorLabel: string | null; tipo: string; texto: string | null };

function linea(m: Fila): string {
  const texto = (m.texto ?? "").replace(/\s+/g, " ").trim() || `[${m.tipo.toLowerCase()}]`;
  if (m.direccion === "NOTA") return `Nota interna de ${m.autorLabel ?? "el equipo"}: ${texto}`;
  if (m.direccion === "ENTRANTE") return `Cliente: ${texto}`;
  const quien = m.autor === "BOT" ? "Bot" : m.autor === "CELULAR" ? "Equipo (celular)" : (m.autorLabel ?? "Equipo");
  return `${quien}: ${texto}`;
}

export async function generarResumen(workspaceId: string, chatId: string, deps: Deps = {}): Promise<string | null> {
  try {
    const cfg = (deps.config ?? leerConfigBot)();
    if (!cfg.enabled || !cfg.anthropicApiKey) return null;
    const ahora = deps.ahora ?? new Date();
    const chat = await prisma.fotofficeWaChat.findFirst({ where: { id: chatId, workspaceId }, select: { id: true } });
    if (!chat) return null;
    const plataforma = plataformaDe(workspaceId);
    const uso = await (deps.uso ?? usoWa)({ plataforma, chatId, ahora });
    // El tope diario es de respuestas del bot al cliente: para un resumen sólo cuentan los de gasto.
    if (!decidirLimites(cfg.limits, { ...uso, mensajesHoyPersona: 0 }).permitido) return null;

    const filas = (await prisma.fotofficeWaMensaje.findMany({
      where: { chatId, workspaceId, direccion: { in: ["ENTRANTE", "SALIENTE", "NOTA"] } },
      orderBy: { createdAt: "desc" },
      take: MENSAJES_DEL_RESUMEN,
      select: { direccion: true, autor: true, autorLabel: true, tipo: true, texto: true },
    })) as Fila[];
    if (filas.length === 0) return null;
    const charla = filas.reverse().map(linea).join("\n");

    const r = await (deps.llamar ?? llamarAClaude)(charla, cfg);
    await (deps.registrarUso ?? registrarUsoWa)({ plataforma, chatId, usage: r.usage, costMicroUsd: costMicroUsd(cfg.model, r.usage), contarMensaje: false, ahora }).catch(() => undefined);
    const resumen = truncarSeguro(r.texto.trim(), RESUMEN_MAXIMO);
    if (!resumen) return null;
    await prisma.fotofficeWaChat.update({ where: { id: chat.id }, data: { resumen, resumenEn: ahora } });
    return resumen;
  } catch (e) {
    console.error("[fotoffice][bandeja] no se pudo armar el resumen", detalleDeError(e));
    return null;
  }
}
