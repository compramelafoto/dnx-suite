import { checkLimits } from "@repo/dnx-bot";
import type { LimitesFotoffice } from "./config";

/**
 * Topes de DNX Bot en FOTOFFICE (spec §11): todo FOTOFFICE por mes, cada workspace por mes y cada
 * persona por día. El global y el diario se deciden con `checkLimits` del paquete (mismo criterio
 * que CLF: corta al llegar, no al pasarse); el del workspace se suma acá porque `BotLimits` tiene
 * uno solo. Los textos son propios: los de CLF ofrecen «Hablar con una persona», que acá no existe.
 */

export type UsoFotoffice = {
  mensajesHoyPersona: number;
  gastoMesGlobal: number;
  gastoMesWorkspace: number;
};

export type DecisionLimites =
  | { permitido: true }
  | { permitido: false; motivo: "tope_global" | "tope_workspace" | "diario"; mensaje: string };

export const MENSAJE_TOPE = "Ahora no puedo responder. Podés seguir con el formulario de siempre.";
export const MENSAJE_DIARIO = "Llegaste al máximo de mensajes de hoy. Mañana seguimos.";

export function decidirLimites(l: LimitesFotoffice, u: UsoFotoffice): DecisionLimites {
  const global = checkLimits(
    { maxMessagesPerUserPerDay: Number.POSITIVE_INFINITY, monthlyCapMicroUsd: l.monthlyCapMicroUsd },
    { userMessagesToday: 0, monthMicroUsd: u.gastoMesGlobal },
  );
  if (!global.allowed) return { permitido: false, motivo: "tope_global", mensaje: MENSAJE_TOPE };

  const workspace = checkLimits(
    { maxMessagesPerUserPerDay: Number.POSITIVE_INFINITY, monthlyCapMicroUsd: l.workspaceMonthlyCapMicroUsd },
    { userMessagesToday: 0, monthMicroUsd: u.gastoMesWorkspace },
  );
  if (!workspace.allowed) return { permitido: false, motivo: "tope_workspace", mensaje: MENSAJE_TOPE };

  const diario = checkLimits(
    { maxMessagesPerUserPerDay: l.maxMessagesPerUserPerDay, monthlyCapMicroUsd: 0 },
    { userMessagesToday: u.mensajesHoyPersona, monthMicroUsd: 0 },
  );
  if (!diario.allowed) return { permitido: false, motivo: "diario", mensaje: MENSAJE_DIARIO };
  return { permitido: true };
}
