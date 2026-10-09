import "server-only";
import { prisma } from "@repo/db";
import type { AccionLote, ContextoListado, Opcion, ResultadoLote } from "@/lib/listado/tipos";
import type { CtxProyectos } from "./acceso";
import { equipoDeProyectos } from "./equipo";
import { editarDatos, reanudar, suspender } from "./proyectos";

/**
 * Acciones en lote de la lista de Proyectos: asignar responsable, suspender y reanudar. Exigen
 * "Gestionar" en Proyectos (`operar`). Cada proyecto pasa por la MISMA función que usa la ficha
 * (`editarDatos`, `suspender`, `reanudar`); lo que falla no frena al resto. Los ids ya vienen
 * acotados al workspace (`traerPorIds` / `traerIds`) y cada función los vuelve a mirar.
 */

export const MAXIMO_LOTE_PROYECTOS = 200;
const SIN_RESPONSABLE = "ninguno";

export const MOTIVOS_LOTE_PROYECTOS = {
  mismoResponsable: "ya tiene ese responsable",
  yaSuspendido: "ya está suspendido",
  noSuspendido: "no está suspendido",
  cerrado: "ya está cerrado",
  opcion: "la opción elegida ya no es válida",
} as const;

/** Motivos de suspensión que se ofrecen en lote (el motivo es obligatorio en cada proyecto). */
export const MOTIVOS_DE_SUSPENSION: readonly Opcion[] = [
  { valor: "cliente", etiqueta: "A pedido del cliente" },
  { valor: "material", etiqueta: "Falta material del cliente" },
  { valor: "pago", etiqueta: "Pago pendiente" },
  { valor: "reprogramado", etiqueta: "Reprogramado" },
  { valor: "otro", etiqueta: "Otro motivo" },
];

type Excluido = { id: string; motivo: string };

function contextoDe(ctx: ContextoListado): CtxProyectos {
  return { workspaceId: ctx.workspaceId, userId: ctx.userId, userLabel: ctx.userLabel, role: ctx.role, acceso: ctx.acceso };
}

const usuarioDe = (parametro: string | null): number | null => (parametro === SIN_RESPONSABLE || parametro === null ? null : Number(parametro));

async function opcionesDeResponsable(ctx: ContextoListado): Promise<Opcion[]> {
  const equipo = await equipoDeProyectos(ctx.workspaceId);
  return [{ valor: SIN_RESPONSABLE, etiqueta: "Sin responsable" }, ...equipo.map((r) => ({ valor: String(r.id), etiqueta: r.nombre }))];
}

/** Estado de cada proyecto del lote: responsable, si está suspendido y si ya cerró (sin recorrido abierto). */
async function estadoDe(workspaceId: string, ids: string[]) {
  const [filas, abiertos] = await Promise.all([
    prisma.fotofficeProyecto.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, ownerUserId: true, suspendedAt: true } }),
    prisma.fotofficeJourney.findMany({ where: { workspaceId, subjectType: "PROYECTO", closedAt: null, subjectId: { in: ids } }, select: { subjectId: true } }),
  ]);
  const vivos = new Set(abiertos.map((a) => a.subjectId as string));
  return new Map(
    filas.map((f) => [f.id as string, { ownerUserId: f.ownerUserId as number | null, suspendido: f.suspendedAt !== null, cerrado: !vivos.has(f.id as string) }]),
  );
}

async function separar(
  ctx: ContextoListado,
  ids: string[],
  motivoDeExclusion: (e: { ownerUserId: number | null; suspendido: boolean; cerrado: boolean }) => string | null,
): Promise<{ elegibles: string[]; excluidos: Excluido[] }> {
  const estado = await estadoDe(ctx.workspaceId, ids);
  const elegibles: string[] = [];
  const excluidos: Excluido[] = [];
  for (const id of ids) {
    const e = estado.get(id);
    const motivo = e ? motivoDeExclusion(e) : "no se encontró";
    if (motivo) excluidos.push({ id, motivo });
    else elegibles.push(id);
  }
  return { elegibles, excluidos };
}

function todasFallan(ids: string[], error: string): ResultadoLote {
  return { aplicados: 0, fallidos: ids.map((id) => ({ id, error })), detalle: [] };
}

/** Aplica `operacion` proyecto por proyecto. Lo que falla no frena al resto. */
async function porProyecto(
  ids: string[],
  operacion: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>,
  detalle: (id: string) => Record<string, unknown>,
): Promise<ResultadoLote> {
  const r: ResultadoLote = { aplicados: 0, fallidos: [], detalle: [] };
  for (const id of ids) {
    try {
      const hecho = await operacion(id);
      if (hecho.ok) {
        r.aplicados++;
        r.detalle.push({ id, ...detalle(id) });
      } else r.fallidos.push({ id, error: hecho.error });
    } catch (e) {
      console.error("[proyectos] acción en lote falló", { error: (e as { name?: string } | null)?.name ?? "desconocido" });
      r.fallidos.push({ id, error: "no se pudo guardar" });
    }
  }
  return r;
}

export const ACCIONES_PROYECTOS: AccionLote[] = [
  {
    clave: "responsable",
    etiqueta: "Asignar responsable",
    capacidad: "operar",
    maximo: MAXIMO_LOTE_PROYECTOS,
    confirmacion: "Vas a poner a {parametro} como responsable de {n} proyectos.",
    parametro: { etiqueta: "Responsable", opciones: opcionesDeResponsable },
    elegibles: (ctx, ids, parametro) =>
      separar(ctx, ids, (e) => (e.ownerUserId === usuarioDe(parametro) ? MOTIVOS_LOTE_PROYECTOS.mismoResponsable : null)),
    aplicar: async (ctx, ids, parametro) => {
      // Se vuelve a mirar al aplicar: sólo alguien del equipo con "Gestionar" en Proyectos.
      if (!(await opcionesDeResponsable(ctx)).some((o) => o.valor === parametro)) return todasFallan(ids, MOTIVOS_LOTE_PROYECTOS.opcion);
      const userId = usuarioDe(parametro);
      return porProyecto(ids, (id) => editarDatos(contextoDe(ctx), id, { ownerUserId: userId }), () => ({ despues: userId }));
    },
  },
  {
    clave: "suspender",
    etiqueta: "Suspender",
    capacidad: "operar",
    maximo: MAXIMO_LOTE_PROYECTOS,
    confirmacion: "Vas a suspender {n} proyectos. Motivo: «{parametro}».",
    parametro: { etiqueta: "Motivo", opciones: async () => [...MOTIVOS_DE_SUSPENSION] },
    elegibles: (ctx, ids) =>
      separar(ctx, ids, (e) => (e.suspendido ? MOTIVOS_LOTE_PROYECTOS.yaSuspendido : e.cerrado ? MOTIVOS_LOTE_PROYECTOS.cerrado : null)),
    aplicar: async (ctx, ids, parametro) => {
      const motivo = MOTIVOS_DE_SUSPENSION.find((o) => o.valor === parametro);
      if (!motivo) return todasFallan(ids, MOTIVOS_LOTE_PROYECTOS.opcion);
      return porProyecto(ids, (id) => suspender(contextoDe(ctx), id, motivo.etiqueta), () => ({ motivo: motivo.etiqueta }));
    },
  },
  {
    clave: "reanudar",
    etiqueta: "Reanudar",
    capacidad: "operar",
    maximo: MAXIMO_LOTE_PROYECTOS,
    confirmacion: "Vas a reanudar {n} proyectos.",
    elegibles: (ctx, ids) => separar(ctx, ids, (e) => (e.suspendido ? null : MOTIVOS_LOTE_PROYECTOS.noSuspendido)),
    aplicar: (ctx, ids) => porProyecto(ids, (id) => reanudar(contextoDe(ctx), id), () => ({})),
  },
];
