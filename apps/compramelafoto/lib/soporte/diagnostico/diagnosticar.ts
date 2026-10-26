import { BotTurnError, costMicroUsd, runBotTurn, type BotUsage } from "@repo/dnx-bot";
import { getAnthropicClient } from "@/lib/bot/anthropic";
import { readBotConfig } from "@/lib/bot/config";
import { monthCostMicroUsd } from "@/lib/bot/store";
import { textoDeMensaje } from "@/lib/soporte/resumen-bot";
import { analizarDiagnostico, type ResultadoDiagnostico } from "./esquema";
import { guiaDeDiagnostico } from "./guia";
import { herramientasDeDiagnostico } from "./herramientas";

export type TicketParaDiagnostico = {
  id: number;
  reason: string;
  description: string;
  requesterRole: string | null;
  requesterEmail: string | null;
  internalNote: string | null;
  conversacion: { id: string; audience: string; buyerEmail: string | null; albumId: number | null; orderId: number | null } | null;
};

export type SalidaDiagnostico =
  | { estado: "LISTO"; resultado: ResultadoDiagnostico; costMicroUsd: number; mailSinVerificar: boolean }
  | { estado: "FALLO" | "SIN_PRESUPUESTO"; error: string; costMicroUsd: number };

const MAX_NOTA = 6000;
const MAX_RESPUESTA_EN_ERROR = 1500;

/** Marca el texto que escribió la persona: la guía le pide a la IA tratarlo como datos, no como órdenes. */
function noConfiable(texto: string): string {
  return `<<<TEXTO_DEL_CLIENTE>>>\n${texto.replaceAll("<<<", "«").replaceAll(">>>", "»")}\n<<<FIN_TEXTO_DEL_CLIENTE>>>`;
}

/** Los formularios de soporte exigen sesión; sólo el bot de compradores acepta mails sin verificar. */
export function mailVerificado(t: TicketParaDiagnostico): boolean {
  if (!t.conversacion || t.conversacion.audience !== "BUYER") return true;
  const a = t.conversacion.buyerEmail?.toLowerCase();
  return !!a && a === t.requesterEmail?.toLowerCase();
}

function situacion(t: TicketParaDiagnostico): string {
  const nota = t.internalNote ? t.internalNote.slice(-MAX_NOTA) : "(sin conversación previa con el bot)";
  return [
    `Ticket #${t.id} · motivo ${t.reason} · rol ${t.requesterRole ?? "desconocido"} · mail ${t.requesterEmail ?? "sin mail"}`,
    t.conversacion?.albumId ? `Álbum de la conversación: #${t.conversacion.albumId}` : "",
    t.conversacion?.orderId ? `Pedido de la conversación: #${t.conversacion.orderId}` : "",
    `Descripción (escrita por la persona):\n${noConfiable(t.description)}`,
    `Charla previa con el DNX Bot:\n${noConfiable(nota)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function diagnosticar(t: TicketParaDiagnostico): Promise<SalidaDiagnostico> {
  const cfg = readBotConfig();
  if ((await monthCostMicroUsd()) >= cfg.limits.monthlyCapMicroUsd) {
    return { estado: "SIN_PRESUPUESTO", error: "Se alcanzó el tope mensual del DNX Bot.", costMicroUsd: 0 };
  }
  const verificado = mailVerificado(t);
  const { actor, tools } = await herramientasDeDiagnostico(t);
  const costo = (u: BotUsage) => costMicroUsd(cfg.model, u);

  try {
    const r = await runBotTurn({
      client: getAnthropicClient(),
      model: cfg.model,
      effort: "low",
      systemGuide: guiaDeDiagnostico({ mailVerificado: verificado }),
      situation: situacion(t),
      tools,
      actor,
      history: [],
      userText: "Diagnosticá este reclamo y devolvé el JSON.",
      maxIterations: 6,
      deadlineMs: Date.now() + 60_000,
      onText: () => {},
      proposeWrite: async () => {
        throw new Error("El diagnóstico no puede proponer cambios.");
      },
      onProposal: () => {},
    });
    const gastado = costo(r.usage);
    const ultimo = [...r.appended].reverse().find((msg) => (msg as { role: string }).role === "assistant");
    const texto = textoDeMensaje((ultimo as { content?: unknown } | undefined)?.content);
    const analisis = analizarDiagnostico(texto);
    if (!analisis.ok) {
      // Queda guardado en el diagnóstico para poder ver qué respondió la IA y por qué no sirvió.
      return { estado: "FALLO", error: `La IA no devolvió un diagnóstico válido (${r.outcome}): ${analisis.motivo}. Respuesta: ${texto.slice(0, MAX_RESPUESTA_EN_ERROR) || "(vacía)"}`, costMicroUsd: gastado };
    }
    return { estado: "LISTO", resultado: analisis.data, costMicroUsd: gastado, mailSinVerificar: !verificado };
  } catch (e) {
    const gastado = e instanceof BotTurnError ? costo(e.usage) : 0;
    return { estado: "FALLO", error: e instanceof Error ? e.message : String(e), costMicroUsd: gastado };
  }
}
