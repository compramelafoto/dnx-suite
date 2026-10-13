import { defineTool, z, type BotTool } from "@repo/dnx-bot";
import { guardarPerfilPrecios, leerPerfilPrecios } from "@/lib/precios/perfil";
import { normalizarPerfil } from "@/lib/precios/perfil-datos";
import type { CtxBot } from "../acceso";
import type { EstadoPerfil } from "../situacion";
import { cambiosEntre, esquemaParchePerfil, perfilBase, simularPerfil, tarjetaDelPerfil, vistaDelPerfil } from "../motor";

/**
 * Etapa 1 · perfil de precios conversado (spec §6.1). Sólo para quien tiene `configurar`: lo decide
 * `herramientasPara`, y además `leerPerfilPrecios` / `guardarPerfilPrecios` lo vuelven a chequear.
 * El parche se reenvía completo en cada llamada: el borrador del perfil es la conversación misma.
 */

const entradaParche = z.object({ parche: esquemaParchePerfil });

async function base(ctx: CtxBot) {
  const g = await leerPerfilPrecios(ctx);
  return { guardado: g, perfil: perfilBase(g?.perfil ?? null), source: g?.source ?? null };
}

async function prepararGuardado(ctx: CtxBot, parche: z.infer<typeof esquemaParchePerfil>) {
  const b = await base(ctx);
  const s = simularPerfil(b.perfil, parche, "dnx-bot");
  const cambios = cambiosEntre(b.perfil, s.perfil);
  const antes = vistaDelPerfil(b.perfil, b.source).resumen.valorHora ?? "sin calcular";
  const ahora = s.vista.resumen.valorHora ?? "sin calcular";
  return { b, s, cambios, antes, ahora };
}

/** Estado del perfil para la situación del turno (sin montos). null para quien no configura. */
export async function estadoDelPerfil(ctx: CtxBot): Promise<EstadoPerfil | null> {
  if (!ctx.capacidades.configurar) return null;
  const b = await base(ctx);
  const v = vistaDelPerfil(b.perfil, b.source);
  return { existe: !!b.guardado, completo: v.completo, faltan: v.faltan, origen: v.origen };
}

export function herramientasDePerfil(ctx: CtxBot): BotTool[] {
  return [
    defineTool({
      name: "ver_perfil_de_precios",
      description:
        "Lee el perfil de precios guardado del workspace (¿Cuánto Cobro?): resumen (valor hora, costo hora…), qué falta y cada dato, con los ids de los rubros y renglones de gastos. Usala antes de preguntar o de simular.",
      input: z.object({}),
      kind: "read",
      run: async () => {
        const b = await base(ctx);
        return { ok: true, message: b.guardado ? "Perfil guardado." : "Todavía no hay perfil guardado.", data: { existe: !!b.guardado, ...vistaDelPerfil(b.perfil, b.source) } };
      },
    }),
    defineTool({
      name: "simular_perfil",
      description:
        "Aplica al perfil guardado los datos que dijo la persona (el parche completo de esta conversación) SIN guardar, y devuelve el resultado del motor, los errores y lo que falta. Muestra la tarjeta de cálculo. Usala para mostrar el valor hora antes de proponer guardar.",
      input: entradaParche,
      kind: "read",
      run: async ({ parche }) => {
        const b = await base(ctx);
        const s = simularPerfil(b.perfil, parche, b.source);
        return {
          ok: true,
          message: s.errores.length ? "Hay datos para revisar." : "Simulación lista (sin guardar).",
          data: { errores: s.errores, ...s.vista, tarjeta: tarjetaDelPerfil(s) },
        };
      },
    }),
    defineTool({
      name: "guardar_perfil_de_precios",
      description:
        "Propone guardar el perfil de precios con los datos de la conversación (el parche completo). No se guarda hasta que la persona toque «Confirmar» en la tarjeta.",
      input: entradaParche,
      kind: "write",
      describe: async ({ parche }) => {
        const { s, cambios, antes, ahora } = await prepararGuardado(ctx, parche);
        if (s.errores.length) throw new Error(s.errores.join(" "));
        if (cambios.length === 0) throw new Error("No hay cambios para guardar.");
        const n = cambios.length;
        return [
          `Guardar el perfil de precios: ${n} ${n === 1 ? "dato cambiado" : "datos cambiados"}. Valor hora: antes ${antes} → ahora ${ahora}.`,
          ...cambios.map((c) => `- ${c.etiqueta}: ${c.ahora}${c.antes === "sin dato" ? "" : ` (antes ${c.antes})`}`),
        ].join("\n");
      },
      run: async ({ parche }) => {
        // Se relee el perfil: si cambió desde la propuesta, se guarda sobre lo actual.
        const { b, s, ahora } = await prepararGuardado(ctx, parche);
        if (s.errores.length) return { ok: false, message: s.errores.join(" ") };
        const r = await guardarPerfilPrecios(ctx, s.perfil, { source: "dnx-bot" });
        if (!r.ok) return { ok: false, message: r.error };
        return {
          ok: true,
          message: `Guardado. Valor hora: ${ahora}. Si tenés abierto Configuración → Precios, recargala para ver los datos.`,
          ...(b.guardado ? { before: { perfil: b.guardado.perfil, source: b.guardado.source } } : {}),
          after: { valorHora: ahora },
        };
      },
      undo: async (before) => {
        const b = before as { perfil?: unknown; source?: unknown } | null;
        const perfil = b && typeof b === "object" ? normalizarPerfil(b.perfil) : null;
        if (!perfil) return { ok: false, message: "No tengo el perfil anterior para volver atrás." };
        const r = await guardarPerfilPrecios(ctx, perfil, { source: b?.source === "dnx-bot" ? "dnx-bot" : "manual" });
        return r.ok ? { ok: true, message: "Listo, volví a dejar el perfil como estaba." } : { ok: false, message: r.error };
      },
    }),
  ];
}
