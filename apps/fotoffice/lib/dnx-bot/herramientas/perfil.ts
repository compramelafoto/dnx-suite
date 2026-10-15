import { defineTool, z, type BotTool } from "@repo/dnx-bot";
import { guardarPerfilPrecios, leerPerfilPrecios } from "@/lib/precios/perfil";
import { normalizarPerfil } from "@/lib/precios/perfil-datos";
import type { CtxBot } from "../acceso";
import { fusionarParches, loAnotado, parcheDelBorrador, rubrosSinDatos, type Anotacion } from "../borrador";
import { anotarEnBorrador, leerBorrador, limpiarBorrador, type RefBorrador } from "../borrador-store";
import type { EstadoPerfil } from "../situacion";
import {
  aplicarParche,
  cambiosEntre,
  esquemaParchePerfil,
  perfilBase,
  simularPerfil,
  tarjetaDelPerfil,
  vistaDelPerfil,
  type ParchePerfil,
} from "../motor";

/**
 * Etapa 1 · perfil de precios conversado (spec §6.1). Sólo para quien tiene `configurar`: lo decide
 * `herramientasPara`, y además `leerPerfilPrecios` / `guardarPerfilPrecios` lo vuelven a chequear.
 *
 * Lo que la persona va contando se anota en un BORRADOR guardado aparte (`anotar_en_borrador`), sin
 * tocar el perfil: antes vivía sólo en el historial y un corte de conversación lo tiraba (13/10).
 * Simular y guardar suman el borrador solos; al guardar bien, el borrador se limpia.
 */

const entradaParche = z.object({ parche: esquemaParchePerfil });
const entradaGuardar = z.object({
  parche: esquemaParchePerfil,
  borradorHasta: z.string().max(40).optional().describe("No lo completes: lo pone el servidor."),
});

/** Lectura y guardado del perfil, y el borrador. Se inyectan sólo en `bot:eval` y en las pruebas. */
export type DepsBorrador = {
  leer: (r: RefBorrador) => Promise<Anotacion[]>;
  anotar: (r: RefBorrador, parche: ParchePerfil) => Promise<Anotacion[]>;
  limpiar: (r: RefBorrador, hasta: Date) => Promise<void>;
};
export type DepsPerfil = { leer: typeof leerPerfilPrecios; guardar: typeof guardarPerfilPrecios; borrador?: DepsBorrador };
const BORRADOR: DepsBorrador = { leer: leerBorrador, anotar: anotarEnBorrador, limpiar: limpiarBorrador };
const DEPS: DepsPerfil = { leer: leerPerfilPrecios, guardar: guardarPerfilPrecios, borrador: BORRADOR };

const ref = (ctx: CtxBot): RefBorrador => ({ plataforma: ctx.plataforma, userId: ctx.userId! });

async function base(ctx: CtxBot, deps: DepsPerfil = DEPS) {
  const g = await deps.leer(ctx);
  return { guardado: g, perfil: perfilBase(g?.perfil ?? null), source: g?.source ?? null };
}

async function borrador(ctx: CtxBot, deps: DepsPerfil = DEPS): Promise<Anotacion[]> {
  return (deps.borrador ?? BORRADOR).leer(ref(ctx));
}

async function prepararGuardado(ctx: CtxBot, parche: ParchePerfil, deps: DepsPerfil) {
  const b = await base(ctx, deps);
  const s = simularPerfil(b.perfil, parche, "dnx-bot");
  const cambios = cambiosEntre(b.perfil, s.perfil);
  const antes = vistaDelPerfil(b.perfil, b.source).resumen.valorHora ?? "sin calcular";
  const ahora = s.vista.resumen.valorHora ?? "sin calcular";
  return { b, s, cambios, antes, ahora };
}

/** Lo que se cuenta del borrador al modelo: qué está anotado (sin montos), totales del motor y lo que falta. */
function vistaDelBorrador(perfil: ReturnType<typeof perfilBase>, parche: ParchePerfil, source: string | null) {
  const s = simularPerfil(perfil, parche, source);
  return {
    anotado: loAnotado(parche, perfil),
    rubrosSinDatos: rubrosSinDatos(parche, perfil),
    conversiones: s.conversiones,
    errores: s.errores,
    completo: s.vista.completo,
    faltan: s.vista.faltan,
    resumen: s.vista.resumen,
  };
}

/**
 * Estado del perfil para la situación del turno (sin montos). null para quien no configura.
 * `borradorHasta`: sólo cuenta lo anotado antes de ese momento (el comienzo de lo que el modelo ve
 * del historial). Así la situación no cambia con cada anotación y el caché del historial sirve.
 */
export async function estadoDelPerfil(ctx: CtxBot, opts: { borradorHasta?: Date } = {}, deps: DepsPerfil = DEPS): Promise<EstadoPerfil | null> {
  if (!ctx.capacidades.configurar) return null;
  const [b, anotaciones] = await Promise.all([base(ctx, deps), borrador(ctx, deps)]);
  const v = vistaDelPerfil(b.perfil, b.source);
  const estado: EstadoPerfil = { existe: !!b.guardado, completo: v.completo, faltan: v.faltan, origen: v.origen };
  const parche = parcheDelBorrador(anotaciones, opts.borradorHasta);
  if (Object.keys(parche).length === 0) return estado;
  const vb = vistaDelBorrador(b.perfil, parche, b.source);
  return { ...estado, borrador: { anotado: vb.anotado, faltan: vb.faltan, rubrosSinDatos: vb.rubrosSinDatos } };
}

export function herramientasDePerfil(ctx: CtxBot, deps: DepsPerfil = DEPS): BotTool[] {
  const dbBorrador = deps.borrador ?? BORRADOR;
  return [
    defineTool({
      name: "ver_perfil_de_precios",
      description:
        "Lee el perfil de precios guardado del workspace (¿Cuánto Cobro?): resumen (valor hora, costo hora…), qué falta y cada dato, con los ids de los rubros y renglones de gastos. Trae también el borrador (lo que la persona ya contó y quedó anotado sin guardar) con sus totales. Usala antes de preguntar o de simular.",
      input: z.object({}),
      kind: "read",
      run: async () => {
        const [b, anotaciones] = await Promise.all([base(ctx, deps), borrador(ctx, deps)]);
        const parche = parcheDelBorrador(anotaciones);
        const hayBorrador = Object.keys(parche).length > 0;
        return {
          ok: true,
          message: [
            b.guardado ? "Perfil guardado." : "Todavía no hay perfil guardado.",
            hayBorrador ? "Hay un borrador con lo que ya contó: seguí desde ahí, sin volver a preguntar lo anotado." : "",
          ]
            .filter(Boolean)
            .join(" "),
          data: {
            existe: !!b.guardado,
            ...vistaDelPerfil(b.perfil, b.source),
            borrador: hayBorrador ? vistaDelBorrador(b.perfil, parche, b.source) : null,
          },
        };
      },
    }),
    defineTool({
      name: "anotar_en_borrador",
      description:
        "Anota en el borrador del perfil el dato que la persona acaba de dar o corregir (sólo ese dato, no todo de nuevo). No toca el perfil guardado ni pide «Confirmar»; queda anotado aunque la conversación se corte. Montos que no son por mes van con su período: el servidor hace la cuenta. Devuelve lo anotado, la cuenta de cada período y los totales hasta ahora (tarjeta).",
      input: entradaParche,
      kind: "read",
      run: async ({ parche }) => {
        const [b, anotaciones] = await Promise.all([base(ctx, deps), borrador(ctx, deps)]);
        const previo = parcheDelBorrador(anotaciones);
        // Los errores del dato nuevo, sobre el perfil con lo ya anotado (p. ej. horas por tarea con las horas por semana del borrador).
        const conPrevio = aplicarParche(b.perfil, previo).perfil;
        const nuevo = aplicarParche(conPrevio, parche);
        if (nuevo.errores.length) return { ok: false, message: `No lo anoté: ${nuevo.errores.join(" ")}` };
        const todas = await dbBorrador.anotar(ref(ctx), parche);
        const total = parcheDelBorrador(todas);
        const s = simularPerfil(b.perfil, total, b.source);
        const tarjeta = { ...tarjetaDelPerfil({ ...s, conversiones: nuevo.conversiones }), titulo: "Tu perfil hasta ahora (borrador, sin guardar)" };
        return {
          ok: true,
          message: "Anotado en el borrador (todavía sin guardar en el perfil).",
          data: { ...vistaDelBorrador(b.perfil, total, b.source), conversiones: nuevo.conversiones, tarjeta },
        };
      },
    }),
    defineTool({
      name: "simular_perfil",
      description:
        "Aplica al perfil guardado el borrador (todo lo anotado) más este parche SIN guardar ni anotar, y devuelve el resultado del motor, los errores y lo que falta. Muestra la tarjeta de cálculo. Usala para mostrar el valor hora antes de proponer guardar. El parche puede ir vacío.",
      input: entradaParche,
      kind: "read",
      run: async ({ parche }) => {
        const [b, anotaciones] = await Promise.all([base(ctx, deps), borrador(ctx, deps)]);
        const s = simularPerfil(b.perfil, fusionarParches(parcheDelBorrador(anotaciones), parche), b.source);
        return {
          ok: true,
          message: s.errores.length ? "Hay datos para revisar." : "Simulación lista (sin guardar).",
          data: { errores: s.errores, ...s.vista, conversiones: s.conversiones, tarjeta: tarjetaDelPerfil(s) },
        };
      },
    }),
    defineTool({
      name: "guardar_perfil_de_precios",
      description:
        "Propone guardar el perfil de precios con todo lo anotado en el borrador más el parche (lo que todavía no anotaste; puede ir vacío). No se guarda hasta que la persona toque «Confirmar» en la tarjeta.",
      input: entradaGuardar,
      kind: "write",
      // Junta el borrador al proponer: lo que se confirma es exactamente lo que mostró la tarjeta.
      prepare: async ({ parche }) => {
        const anotaciones = await borrador(ctx, deps);
        return {
          parche: fusionarParches(parcheDelBorrador(anotaciones), parche),
          ...(anotaciones.length ? { borradorHasta: anotaciones.at(-1)!.en } : {}),
        };
      },
      describe: async ({ parche }) => {
        const { s, cambios, antes, ahora } = await prepararGuardado(ctx, parche, deps);
        if (s.errores.length) throw new Error(s.errores.join(" "));
        if (cambios.length === 0) throw new Error("No hay cambios para guardar.");
        const n = cambios.length;
        return [
          `Guardar el perfil de precios: ${n} ${n === 1 ? "dato cambiado" : "datos cambiados"}. Valor hora: antes ${antes} → ahora ${ahora}.`,
          ...cambios.map((c) => `- ${c.etiqueta}: ${c.ahora}${c.antes === "sin dato" ? "" : ` (antes ${c.antes})`}`),
          ...s.conversiones.map((c) => `- (${c.etiqueta}: ${c.detalle})`),
        ].join("\n");
      },
      run: async ({ parche, borradorHasta }) => {
        // Se relee el perfil: si cambió desde la propuesta, se guarda sobre lo actual.
        const { b, s, ahora } = await prepararGuardado(ctx, parche, deps);
        if (s.errores.length) return { ok: false, message: s.errores.join(" ") };
        // Con la versión recién leída: si alguien guardó en el medio, no se pisa.
        const r = await deps.guardar(ctx, s.perfil, { source: "dnx-bot", esperado: b.guardado ? b.guardado.actualizado : null });
        if (!r.ok) return { ok: false, message: r.error };
        // Lo anotado ya está en el perfil. Lo anotado DESPUÉS de proponer queda en el borrador.
        const hasta = borradorHasta ? new Date(borradorHasta) : null;
        if (hasta && !Number.isNaN(hasta.getTime())) {
          await dbBorrador.limpiar(ref(ctx), hasta).catch((e: unknown) => console.error("[dnx-bot] limpiar borrador", e));
        }
        return {
          ok: true,
          message: `Guardado. Valor hora: ${ahora}. Si tenés abierto Configuración → Precios, recargala para ver los datos.`,
          ...(b.guardado
            ? { before: { perfil: b.guardado.perfil, source: b.guardado.source, guardadoPorElBot: r.actualizado.toISOString() } }
            : {}),
          after: { valorHora: ahora },
        };
      },
      undo: async (before) => {
        const b = before as { perfil?: unknown; source?: unknown; guardadoPorElBot?: unknown } | null;
        const perfil = b && typeof b === "object" ? normalizarPerfil(b.perfil) : null;
        if (!perfil) return { ok: false, message: "No tengo el perfil anterior para volver atrás." };
        // Sólo si el perfil sigue siendo el que guardó el bot: deshacer no pisa un cambio posterior.
        const esperado = typeof b?.guardadoPorElBot === "string" ? new Date(b.guardadoPorElBot) : undefined;
        const r = await deps.guardar(ctx, perfil, {
          source: b?.source === "dnx-bot" ? "dnx-bot" : "manual",
          ...(esperado && !Number.isNaN(esperado.getTime()) ? { esperado } : {}),
        });
        return r.ok ? { ok: true, message: "Listo, volví a dejar el perfil como estaba." } : { ok: false, message: r.error };
      },
    }),
  ];
}
