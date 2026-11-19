/**
 * Qué incidente deja el bot cuando un tope le impide responder. Módulo PURO.
 *
 * Los topes de gasto del mes (del estudio o de todo FOTOFFICE) cortan el bot para todos los chats:
 * van como urgentes, así llega el aviso por Telegram. La marca lleva el mes, para que el aviso salga
 * una vez por mes y no quede tapado por el del mes anterior. El tope diario de un chat no avisa.
 */
import { mesArgentino } from "@/lib/dnx-bot/dia-argentino";

export type MotivoTope = "tope_global" | "tope_workspace" | "diario";

const DETALLE: Record<Exclude<MotivoTope, "diario">, string> = {
  tope_workspace:
    "El estudio llegó al tope de gasto del mes del bot de WhatsApp (FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD en Vercel). Hasta subirlo, los chats nuevos reciben «Dejame chequearlo…» y pasan a una persona.",
  tope_global:
    "FOTOFFICE llegó al tope de gasto del mes del bot (FOTOFFICE_BOT_MONTHLY_CAP_USD en Vercel). Hasta subirlo, los chats nuevos reciben «Dejame chequearlo…» y pasan a una persona.",
};

export function incidenteDeTope(motivo: MotivoTope, ahora: Date): { codigo: string; urgente: boolean; detalle: string } {
  if (motivo === "diario") return { codigo: "tope_diario", urgente: false, detalle: "diario" };
  return { codigo: `${motivo}_${mesArgentino(ahora)}`, urgente: true, detalle: DETALLE[motivo] };
}
