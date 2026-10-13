import "server-only";
import { leerPresupuesto } from "@/lib/presupuestos/presupuestos";
import type { CtxBot } from "./acceso";
import { consultaParaBorrador } from "./consultas";
import type { ContextoPedido } from "./contexto";

/**
 * Los ids que manda la burbuja (botón «Calcular con el bot» del editor, «Preguntale al bot» de la
 * consulta) se revalidan contra el workspace activo con las mismas lecturas de siempre: uno ajeno
 * o inexistente se ignora igual (spec §4.1). Sólo lo que queda llega a la situación.
 */
export type EnPantalla = {
  presupuesto?: { id: string; numero: string | null; estado: string; esBorrador: boolean };
  consulta?: { leadId: string; numero: string | null; nombreDePila: string | null; categoria: string | null; fechaEvento: string | null; tieneFicha: boolean };
};

export async function revalidarContexto(ctx: CtxBot, c: ContextoPedido): Promise<EnPantalla> {
  const out: EnPantalla = {};
  try {
    if (c.presupuestoId) {
      const d = await leerPresupuesto(ctx, c.presupuestoId);
      if (d) out.presupuesto = { id: d.id, numero: d.numero, estado: d.estado, esBorrador: !!d.borrador };
    }
    if (c.consultaLeadId && ctx.capacidades.verConsultas) {
      const k = await consultaParaBorrador(ctx, c.consultaLeadId);
      if (k) {
        out.consulta = {
          leadId: k.leadId,
          numero: k.numero,
          nombreDePila: k.nombreDePila,
          categoria: k.categoria,
          fechaEvento: k.fechaEvento,
          tieneFicha: k.tieneFicha,
        };
      }
    }
  } catch (e) {
    console.error("[dnx-bot] contexto", e instanceof Error ? e.name : "error");
    return {};
  }
  return out;
}
