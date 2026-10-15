import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { reportIncident } from "@/lib/bot/escalamiento";

/** Registrar una falla del sistema: la comparten el bot de fotógrafos y el de compradores. */
export function herramientaReportarProblema(): BotTool {
  return defineTool({
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
  });
}
