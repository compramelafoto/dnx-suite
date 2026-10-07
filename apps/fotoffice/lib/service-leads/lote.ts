import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import type { CtxCircuitos } from "@/lib/circuitos/acceso";
import { SALIDAS } from "@/lib/circuitos/constantes";
import { finDelDiaElegido } from "@/lib/circuitos/ficha-vista";
import { asignarResponsable, cambiarDeCircuito, cambiarVencimiento, cerrar, type Resultado } from "@/lib/circuitos/recorridos";
import { motivosActivos } from "@/lib/circuitos/tablero";
import { responsablesDeConsultas } from "@/lib/consultas/ficha";
import type { AccionLote, ContextoListado, Opcion, ResultadoLote } from "@/lib/listado/tipos";

/**
 * Acciones en lote de la lista de Consultas (spec §3.7): responsable, siguiente acción, cerrar como
 * perdida y pasar a otro circuito. Exigen "Gestionar" en Consultas (`operar`).
 *
 * - Como mucho `MAXIMO_LOTE_CONSULTAS` por acción: los ids viajan en un `IN (...)` y el lote es
 *   uno por uno (cada consulta es su propia transacción del motor).
 * - Los ids ya vienen acotados al workspace (`traerPorIds` / `traerIds`); igual cada recorrido se
 *   vuelve a buscar con el `workspaceId` de la sesión, y el motor lo vuelve a mirar.
 * - Cada consulta pasa por la MISMA función del motor que usa la ficha, así queda en su historial.
 *   La bitácora de la lista (una fila por acción) la escribe `aplicarLote`.
 */

export const MAXIMO_LOTE_CONSULTAS = 200;
const SIN_RESPONSABLE = "ninguno";

export const MOTIVOS_LOTE = {
  sinRecorrido: "no está en un circuito abierto",
  mismoResponsable: "ya tiene ese responsable",
  mismaFecha: "ya tiene esa siguiente acción",
  mismoCircuito: "ya está en ese circuito",
  opcion: "la opción elegida ya no es válida",
  tareasPendientes: "tiene tareas obligatorias pendientes",
} as const;

type Abierto = { journeyId: string; ownerUserId: number | null; circuitId: string; stageId: string | null; stageDueAt: Date | null };
type Excluido = { id: string; motivo: string };

function motor(ctx: ContextoListado): CtxCircuitos {
  return { workspaceId: ctx.workspaceId, userId: ctx.userId, userLabel: ctx.userLabel, role: ctx.role, acceso: ctx.acceso };
}

/** El recorrido de venta abierto de cada consulta del workspace (una lectura para todo el lote). */
export async function recorridosAbiertos(workspaceId: string, leadIds: readonly string[]): Promise<Map<string, Abierto>> {
  const mapa = new Map<string, Abierto>();
  if (leadIds.length === 0) return mapa;
  const filas = await prisma.fotofficeJourney.findMany({
    where: { workspaceId, subjectType: "CAPTACION", kind: "VENTA", closedAt: null, subjectId: { in: [...leadIds] } },
    select: { id: true, subjectId: true, ownerUserId: true, circuitId: true, stageId: true, stageDueAt: true },
  });
  for (const j of filas) {
    mapa.set(j.subjectId, { journeyId: j.id, ownerUserId: j.ownerUserId, circuitId: j.circuitId, stageId: j.stageId, stageDueAt: j.stageDueAt });
  }
  return mapa;
}

/**
 * Los recorridos cuya etapa actual exige tareas y tiene obligatorias sin tildar (la misma regla
 * del motor para avanzar o cambiar de circuito). Una lectura por tabla para todo el lote.
 */
async function conObligatoriasPendientes(workspaceId: string, abiertos: Abierto[]): Promise<Set<string>> {
  const conEtapa = abiertos.filter((a) => a.stageId !== null);
  if (conEtapa.length === 0) return new Set();
  const exigen = await prisma.fotofficeStage.findMany({
    where: { id: { in: [...new Set(conEtapa.map((a) => a.stageId!))] }, circuit: { workspaceId }, requireTasks: true },
    select: { id: true },
  });
  const etapas = new Set(exigen.map((e) => e.id));
  const candidatos = conEtapa.filter((a) => etapas.has(a.stageId!));
  if (candidatos.length === 0) return new Set();
  const tareas = await prisma.fotofficeTask.findMany({
    where: { workspaceId, journeyId: { in: candidatos.map((a) => a.journeyId) }, required: true, doneAt: null },
    select: { journeyId: true, stageId: true },
  });
  const etapaDe = new Map(candidatos.map((a) => [a.journeyId, a.stageId]));
  return new Set(tareas.filter((t) => t.journeyId !== null && etapaDe.get(t.journeyId) === t.stageId).map((t) => t.journeyId!));
}

/** Separa las consultas sin recorrido abierto y las que la acción dejaría igual. */
async function separar(
  ctx: ContextoListado,
  ids: string[],
  igual: (a: Abierto) => string | null,
): Promise<{ elegibles: string[]; excluidos: Excluido[] }> {
  const abiertos = await recorridosAbiertos(ctx.workspaceId, ids);
  const elegibles: string[] = [];
  const excluidos: Excluido[] = [];
  for (const id of ids) {
    const a = abiertos.get(id);
    const motivo = !a ? MOTIVOS_LOTE.sinRecorrido : igual(a);
    if (motivo) excluidos.push({ id, motivo });
    else elegibles.push(id);
  }
  return { elegibles, excluidos };
}

/** Aplica `operacion` (una función del motor) consulta por consulta. Lo que falla no frena al resto. */
async function porConsulta(
  ctx: ContextoListado,
  ids: string[],
  operacion: (journeyId: string, a: Abierto) => Promise<Resultado | { ok: false; error: string }>,
  detalle: (a: Abierto) => Record<string, unknown>,
): Promise<ResultadoLote> {
  const abiertos = await recorridosAbiertos(ctx.workspaceId, ids);
  const r: ResultadoLote = { aplicados: 0, fallidos: [], detalle: [] };
  for (const id of ids) {
    const a = abiertos.get(id);
    if (!a) {
      r.fallidos.push({ id, error: MOTIVOS_LOTE.sinRecorrido });
      continue;
    }
    try {
      const hecho = await operacion(a.journeyId, a);
      if (hecho.ok) {
        r.aplicados++;
        r.detalle.push({ id, journeyId: a.journeyId, ...detalle(a) });
      } else {
        r.fallidos.push({ id, error: hecho.error });
      }
    } catch (e) {
      console.error("[consultas] acción en lote falló", { error: (e as { name?: string } | null)?.name ?? "desconocido" });
      r.fallidos.push({ id, error: "no se pudo guardar" });
    }
  }
  return r;
}

/** "Sin responsable" y el equipo con "Gestionar" en Consultas (`puedeSerResponsable`). */
async function opcionesDeResponsable(ctx: ContextoListado): Promise<Opcion[]> {
  const equipo = await responsablesDeConsultas(ctx.workspaceId);
  return [{ valor: SIN_RESPONSABLE, etiqueta: "Sin responsable" }, ...equipo.map((r) => ({ valor: String(r.id), etiqueta: r.nombre }))];
}

async function opcionesDeMotivo(ctx: ContextoListado): Promise<Opcion[]> {
  return (await motivosActivos(ctx.workspaceId)).map((m) => ({ valor: m.id, etiqueta: m.nombre }));
}

async function opcionesDeCircuito(ctx: ContextoListado): Promise<Opcion[]> {
  const circuitos = await prisma.fotofficeCircuit.findMany({
    where: { workspaceId: ctx.workspaceId, kind: "VENTA", isActive: true },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return circuitos.map((c) => ({ valor: c.id, etiqueta: c.name }));
}

const usuarioDe = (parametro: string | null): number | null => (parametro === SIN_RESPONSABLE || parametro === null ? null : Number(parametro));

/** Todas fallan con el mismo motivo (p. ej. la opción dejó de ser válida entre confirmar y aplicar). */
function todasFallan(ids: string[], error: string): ResultadoLote {
  return { aplicados: 0, fallidos: ids.map((id) => ({ id, error })), detalle: [] };
}

export const ACCIONES_CONSULTAS: AccionLote[] = [
  {
    clave: "responsable",
    etiqueta: "Asignar responsable",
    capacidad: "operar",
    maximo: MAXIMO_LOTE_CONSULTAS,
    confirmacion: "Vas a poner a {parametro} como responsable de {n} consultas.",
    parametro: { etiqueta: "Responsable", opciones: opcionesDeResponsable },
    elegibles: (ctx, ids, parametro) =>
      separar(ctx, ids, (a) => (a.ownerUserId === usuarioDe(parametro) ? MOTIVOS_LOTE.mismoResponsable : null)),
    aplicar: async (ctx, ids, parametro) => {
      // Se vuelve a mirar al aplicar: sólo alguien del equipo con "Gestionar" en Consultas.
      const elegida = (await opcionesDeResponsable(ctx)).find((o) => o.valor === parametro);
      if (!elegida) return todasFallan(ids, MOTIVOS_LOTE.opcion);
      const userId = usuarioDe(parametro);
      return porConsulta(
        ctx,
        ids,
        (journeyId) => asignarResponsable(motor(ctx), journeyId, userId, { nota: `Responsable: ${elegida.etiqueta}.` }),
        (a) => ({ antes: a.ownerUserId, despues: userId }),
      );
    },
  },
  {
    clave: "siguiente",
    etiqueta: "Fijar siguiente acción",
    capacidad: "operar",
    maximo: MAXIMO_LOTE_CONSULTAS,
    confirmacion: "Vas a fijar la siguiente acción de {n} consultas para el {parametro}.",
    parametro: { etiqueta: "Siguiente acción", fecha: true },
    elegibles: (ctx, ids, parametro) => {
      const dueAt = parametro ? finDelDiaElegido(parametro) : null;
      return separar(ctx, ids, (a) => (dueAt && a.stageDueAt?.getTime() === dueAt.getTime() ? MOTIVOS_LOTE.mismaFecha : null));
    },
    aplicar: async (ctx, ids, parametro) => {
      const dueAt = parametro ? finDelDiaElegido(parametro) : null;
      if (!dueAt) return todasFallan(ids, MOTIVOS_LOTE.opcion);
      return porConsulta(
        ctx,
        ids,
        (journeyId) => cambiarVencimiento(motor(ctx), journeyId, dueAt, ""),
        (a) => ({ antes: a.stageDueAt?.toISOString() ?? null, despues: dueAt.toISOString() }),
      );
    },
  },
  {
    clave: "perdida",
    etiqueta: "Cerrar como perdida",
    capacidad: "operar",
    maximo: MAXIMO_LOTE_CONSULTAS,
    confirmacion: "Vas a cerrar {n} consultas como perdidas, con el motivo «{parametro}».",
    parametro: { etiqueta: "Motivo", opciones: opcionesDeMotivo },
    elegibles: (ctx, ids) => separar(ctx, ids, () => null),
    aplicar: (ctx, ids, parametro) =>
      porConsulta(
        ctx,
        ids,
        // El motor vuelve a validar que el motivo sea activo y del workspace.
        (journeyId) => cerrar(motor(ctx), journeyId, SALIDAS.VENTA.fracaso, parametro ?? undefined),
        () => ({ salida: SALIDAS.VENTA.fracaso, motivo: parametro }),
      ),
  },
  {
    clave: "circuito",
    etiqueta: "Pasar a otro circuito",
    capacidad: "operar",
    maximo: MAXIMO_LOTE_CONSULTAS,
    confirmacion: "Vas a pasar {n} consultas al circuito «{parametro}». Empiezan en su primera etapa.",
    parametro: { etiqueta: "Circuito", opciones: opcionesDeCircuito },
    elegibles: async (ctx, ids, parametro) => {
      const r = await separar(ctx, ids, (a) => (a.circuitId === parametro ? MOTIVOS_LOTE.mismoCircuito : null));
      // Con obligatorias pendientes sólo pasa quien puede `configurar` (como "Pasar igual").
      if (puede(ctx.role, "configurar") || r.elegibles.length === 0) return r;
      const abiertos = await recorridosAbiertos(ctx.workspaceId, r.elegibles);
      const frenados = await conObligatoriasPendientes(ctx.workspaceId, [...abiertos.values()]);
      if (frenados.size === 0) return r;
      const elegibles: string[] = [];
      for (const id of r.elegibles) {
        const a = abiertos.get(id);
        if (a && frenados.has(a.journeyId)) r.excluidos.push({ id, motivo: MOTIVOS_LOTE.tareasPendientes });
        else elegibles.push(id);
      }
      return { elegibles, excluidos: r.excluidos };
    },
    aplicar: (ctx, ids, parametro) =>
      porConsulta(
        ctx,
        ids,
        // El motor vuelve a validar que el circuito sea activo, de venta y del workspace.
        (journeyId) => cambiarDeCircuito(motor(ctx), journeyId, parametro ?? ""),
        (a) => ({ antes: a.circuitId, despues: parametro }),
      ),
  },
];
