import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
// Módulo directo (también re-exportado por @/lib/bot/herramientas): no arrastra las herramientas de fotógrafos.
import { herramientaReportarProblema } from "@/lib/bot/herramientas/reportar-problema";
import { abrirCasoComprador, MOTIVOS_CASO } from "../caso";
import type { CompradorActor } from "../identidad";
import { enmascararEmail } from "../mascara";
import { AvisoAlComprador, herramientasDeAccion } from "./acciones";
import { herramientasDeLectura } from "./lectura";

export type ContextoHerramientasComprador = {
  /** Mensaje del turno en curso: todavía no está guardado cuando la herramienta abre un caso. */
  currentUserText?: string;
};

/**
 * Lo que ve el modelo cuando una herramienta de compradores falla por algo interno. El motor
 * le antepone «Falló la consulta:» / «No se pudo preparar la acción:»; el detalle real (host de la
 * base, tablas, consultas) queda sólo en el log del servidor.
 */
export const ERROR_GENERICO_COMPRADOR =
  "hubo un problema interno. Probá una vez más; si vuelve a fallar, ofrecé abrir un caso.";

function errorGenerico(tool: string, fase: "run" | "describe", e: unknown): Error {
  if (e instanceof AvisoAlComprador) return e;
  console.error(`[dnx-bot comprador] ${tool}.${fase} falló:`, e);
  return new Error(ERROR_GENERICO_COMPRADOR);
}

/** Envuelve run/describe para que ningún error interno llegue al modelo (y de ahí, al chat). */
function conErroresGenericos(t: BotTool): BotTool {
  const { run, describe } = t;
  return {
    ...t,
    run: async (input, actor) => {
      try {
        return await run(input, actor);
      } catch (e) {
        throw errorGenerico(t.name, "run", e);
      }
    },
    ...(describe
      ? {
          describe: async (input, actor) => {
            try {
              return await describe(input, actor);
            } catch (e) {
              throw errorGenerico(t.name, "describe", e);
            }
          },
        }
      : {}),
  };
}

function abrirCaso(a: CompradorActor, ctx: ContextoHerramientasComprador): BotTool {
  return defineTool({
    name: "abrir_caso",
    description:
      "Deriva el caso a una persona del equipo, que responde por mail. Usar en el momento para doble cobro, pago que no impactó, reembolsos o contracargos; también si la persona lo pide, si no se resolvió en dos intentos o si está enojada. Un caso por conversación.",
    kind: "read",
    input: z.strictObject({
      motivo: z.enum(MOTIVOS_CASO),
      resumen: z.string().min(10).max(1500).describe("Qué pidió, qué revisaste y qué encontraste"),
      urgente: z.boolean().describe("true si hay plata de por medio, una entrega con fecha o enojo"),
      email: z.string().email().max(254).optional().describe("Mail para responderle; si ya verificó su mail, no hace falta"),
      nombre: z.string().max(120).optional(),
      pedido: z.number().int().positive().optional().describe("Número de pedido, si lo sabe"),
    }),
    run: async (i) => {
      const r = await abrirCasoComprador({
        actor: a,
        email: i.email ?? null,
        nombre: i.nombre ?? null,
        motivo: i.motivo,
        resumen: i.resumen,
        urgente: i.urgente,
        orderId: i.pedido ?? a.enlace?.orderId ?? null,
        currentUserText: ctx.currentUserText,
      });
      if (!r.ok) return { ok: false, message: r.mensaje };
      if (r.reused) {
        return { ok: true, message: `Esta conversación ya tiene el caso #${r.ticketId}; te responden por mail.`, data: { ticketId: r.ticketId } };
      }
      return {
        ok: true,
        message: `Abrí el caso #${r.ticketId}. Te responden por mail a ${enmascararEmail(i.email ?? a.emailVerificado)}.`,
        data: { ticketId: r.ticketId },
      };
    },
  });
}

/** Todas las herramientas del bot de compradores (ninguna de fotógrafos salvo el reporte de fallas). */
export function herramientasComprador(a: CompradorActor, ctx: ContextoHerramientasComprador): BotTool[] {
  return [
    ...herramientasDeLectura(a),
    ...herramientasDeAccion(a),
    abrirCaso(a, ctx),
    herramientaReportarProblema(),
  ].map(conErroresGenericos);
}
