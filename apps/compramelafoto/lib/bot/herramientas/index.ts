import { defineTool, type BotActor, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { escalateToHuman, reportIncident } from "@/lib/bot/escalamiento";
import { ALLOWED_REASONS } from "@/lib/support/sanitize";
import { lecturaTools } from "./lectura";

const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);

export function toolsForActor(actor: BotActor, ctx: { conversationId: string }): BotTool[] {
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
        const { ticketId } = await escalateToHuman({
          actor,
          conversationId: ctx.conversationId,
          motivo: i.motivo,
          resumen: i.resumen,
          urgente: i.urgente,
        });
        return {
          ok: true,
          message: `Abrí el pedido de soporte #${ticketId}. La respuesta le aparece en Soporte y le llega por mail.`,
          data: { ticketId },
        };
      },
    }),
    defineTool({
      name: "reportar_problema_del_sistema",
      description:
        "Registra una falla del sistema (no un error de la persona) para que el equipo técnico la corrija. Sólo datos técnicos; no copies textos de la persona.",
      kind: "read",
      input: z.strictObject({
        area: z.enum(["album", "precios", "packs", "fotos", "subidas", "pedidos", "descargas", "mercadopago", "perfil", "otro"]),
        codigo: z.string().min(2).max(80).describe("Código o mensaje de error exacto"),
        ids: z.record(z.string(), z.union([z.string(), z.number()])).describe("IDs involucrados, ej. {albumId: 3}"),
        detalle: z.string().max(500),
        urgente: z.boolean().describe("true si impide vender o cobrar"),
      }),
      run: async (i) => {
        await reportIncident(i);
        return { ok: true, message: "Quedó registrado para el equipo técnico." };
      },
    }),
  ];
  if (!PHOTOGRAPHER_ROLES.has(actor.role)) return comunes;
  // Las herramientas de escritura (Tasks 10-12) se suman acá.
  return [...lecturaTools, ...comunes];
}
