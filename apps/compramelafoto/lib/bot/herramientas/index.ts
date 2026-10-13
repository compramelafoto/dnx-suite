import { defineTool, type BotActor, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { escalateToHuman } from "@/lib/bot/escalamiento";
import { escolarTools } from "@/lib/bot/escolar/herramientas";
import { ALLOWED_REASONS } from "@/lib/support/sanitize";
import { albumTools } from "./album";
import { lecturaTools } from "./lectura";
import { packTools } from "./packs";
import { pedidosTools } from "./pedidos";
import { perfilTools } from "./perfil";
import { herramientaReportarProblema } from "./reportar-problema";

export { herramientaReportarProblema };

const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);

export type ToolsContext = {
  conversationId: string;
  /** Mensaje del turno en curso: todavía no está guardado cuando la herramienta abre un ticket. */
  currentUserText?: string;
};

export function toolsForActor(actor: BotActor, ctx: ToolsContext): BotTool[] {
  const comunes: BotTool[] = [
    defineTool({
      name: "abrir_ticket",
      description:
        "Deriva el caso a una persona del equipo. Usar si la persona lo pide, si no se resolvió en dos intentos, si es un tema de plata o si está enojada.",
      kind: "read",
      input: z.strictObject({
        motivo: z.enum(ALLOWED_REASONS),
        resumen: z.string().min(10).max(1500).describe("Qué pidió, qué revisaste y qué encontraste"),
        urgente: z.boolean().describe("true si hay cobros, ventas bloqueadas o enojo"),
      }),
      run: async (i) => {
        const { ticketId, reused } = await escalateToHuman({
          actor,
          conversationId: ctx.conversationId,
          motivo: i.motivo,
          resumen: i.resumen,
          urgente: i.urgente,
          currentUserText: ctx.currentUserText,
        });
        return {
          ok: true,
          message: reused
            ? `Esta conversación ya tiene el pedido de soporte #${ticketId}; no abrí otro. La respuesta le aparece en Soporte y le llega por mail.`
            : `Abrí el pedido de soporte #${ticketId}. La respuesta le aparece en Soporte y le llega por mail.`,
          data: { ticketId },
        };
      },
    }),
    herramientaReportarProblema(),
  ];
  if (!PHOTOGRAPHER_ROLES.has(actor.role)) return comunes;
  return [...lecturaTools, ...albumTools, ...packTools, ...perfilTools, ...pedidosTools, ...escolarTools, ...comunes];
}
