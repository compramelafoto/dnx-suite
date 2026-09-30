import "server-only";
import { prisma } from "@repo/db";
import { hoyEnBuenosAires } from "../listado/periodos";
import { estaVencida } from "./calculos";
import { SALIDAS, type Clase } from "./constantes";
import { adaptadorDe, type NombreDeSujeto } from "./sujetos";

/**
 * Datos del tablero de Captación. Todo se lee acotado al workspace de la sesión: el circuito
 * elegido tiene que ser suyo (si no, se usa el predeterminado) y los recorridos, tareas,
 * motivos y responsables se filtran por `workspaceId`.
 */

/** Tarjetas por columna. Pasado el tope, la columna ofrece "y N más" hacia el Modo lista. */
export const TOPE_POR_COLUMNA = 300;
const TIPO_SUJETO = "CAPTACION";
const CLASE: Clase = "VENTA";
const RUTA_LISTA = "/captacion/lista";
const DIA_MS = 24 * 60 * 60 * 1000;

export type TarjetaVista = {
  journeyId: string;
  sujeto: NombreDeSujeto;
  diasEnEtapa: number;
  vencida: boolean;
  tareas: { hechas: number; total: number };
  /** ISO: vuelve tal cual como `esperado` al mover o cerrar. */
  enteredStageAt: string;
  responsableId: number | null;
};

export type EtapaVista = { id: string; nombre: string; color: string; archivada: boolean };
export type ColumnaVista = { etapa: EtapaVista; tarjetas: TarjetaVista[]; total: number; masHref: string | null };
export type CircuitoVista = { id: string; nombre: string; clase: Clase };

export type Tablero = {
  circuito: CircuitoVista | null;
  circuitos: CircuitoVista[];
  columnas: ColumnaVista[];
  salidas: { exito: string; fracaso: string };
  motivos: { id: string; nombre: string }[];
  responsables: { id: number; nombre: string }[];
};

export type FiltrosTablero = { responsable?: number; soloVencidas?: boolean };

/** Días calendario (en Buenos Aires) desde la entrada a la etapa. */
export function diasEnEtapaAR(entrada: Date, ahora: Date): number {
  const desde = Date.parse(`${hoyEnBuenosAires(entrada)}T00:00:00Z`);
  const hasta = Date.parse(`${hoyEnBuenosAires(ahora)}T00:00:00Z`);
  return Math.max(0, Math.round((hasta - desde) / DIA_MS));
}

/** Mismo criterio que `etiquetaDeUsuario` (lib/listado/acceso), sin arrastrar la sesión. */
function nombreDeUsuario(u: { id: number; name?: string | null; email?: string | null } | null | undefined, id: number): string {
  return u?.name?.trim() || u?.email?.trim() || `Usuario ${id}`;
}

async function elegirCircuito(workspaceId: string, circuitoId: string | null) {
  const circuitos = await prisma.fotofficeCircuit.findMany({
    where: { workspaceId, kind: CLASE, isActive: true },
    select: { id: true, name: true, kind: true, isDefault: true },
    orderBy: [{ name: "asc" }],
  });
  const elegido =
    (circuitoId ? circuitos.find((c) => c.id === circuitoId) : undefined) ??
    circuitos.find((c) => c.isDefault) ??
    circuitos[0] ??
    null;
  const vista = (c: (typeof circuitos)[number]): CircuitoVista => ({ id: c.id, nombre: c.name, clase: CLASE });
  return { circuito: elegido ? vista(elegido) : null, circuitos: circuitos.map(vista) };
}

export async function cargarTablero(
  ctx: { workspaceId: string },
  circuitoId: string | null,
  filtros: FiltrosTablero,
  ahora: Date,
): Promise<Tablero> {
  const { workspaceId } = ctx;
  const [{ circuito, circuitos }, motivos, miembros] = await Promise.all([
    elegirCircuito(workspaceId, circuitoId),
    prisma.fotofficeLossReason.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.workspaceMembership.findMany({
      where: { workspaceId },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { userId: "asc" },
    }),
  ]);

  const base = {
    circuitos,
    salidas: SALIDAS[CLASE],
    motivos: motivos.map((m) => ({ id: m.id, nombre: m.name })),
    responsables: miembros
      .map((m) => ({ id: m.userId, nombre: nombreDeUsuario(m.user, m.userId) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
  if (!circuito) return { circuito: null, columnas: [], ...base };

  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: circuito.id, circuit: { workspaceId } },
    select: { id: true, name: true, color: true, order: true, archivedAt: true },
    orderBy: [{ order: "asc" }],
  });

  const abiertos = { workspaceId, circuitId: circuito.id, subjectType: TIPO_SUJETO, closedAt: null };
  // Una etapa archivada sigue apareciendo (al final) mientras tenga recorridos abiertos, para
  // poder sacarlos de ahí. Se decide sin filtros, así la columna no aparece y desaparece.
  const archivadas = [];
  for (const e of etapas.filter((x) => x.archivedAt !== null)) {
    if ((await prisma.fotofficeJourney.count({ where: { ...abiertos, stageId: e.id } })) > 0) archivadas.push(e);
  }
  const visibles = [...etapas.filter((e) => e.archivedAt === null), ...archivadas];

  const where = {
    ...abiertos,
    ...(filtros.responsable !== undefined ? { ownerUserId: filtros.responsable } : {}),
    ...(filtros.soloVencidas ? { stageDueAt: { lt: ahora } } : {}),
  };
  const porEtapa = await Promise.all(
    visibles.map(async (e) => {
      const [filas, total] = await Promise.all([
        prisma.fotofficeJourney.findMany({
          where: { ...where, stageId: e.id },
          select: { id: true, subjectType: true, subjectId: true, stageId: true, enteredStageAt: true, stageDueAt: true, ownerUserId: true },
          orderBy: [{ enteredStageAt: "asc" }, { id: "asc" }],
          take: TOPE_POR_COLUMNA,
        }),
        prisma.fotofficeJourney.count({ where: { ...where, stageId: e.id } }),
      ]);
      return { etapa: e, filas, total };
    }),
  );

  const recorridos = porEtapa.flatMap((c) => c.filas);
  const ids = recorridos.map((j) => j.id);
  const tareas = ids.length
    ? await prisma.fotofficeTask.findMany({
        where: { workspaceId, journeyId: { in: ids } },
        select: { journeyId: true, stageId: true, doneAt: true },
      })
    : [];
  const etapaDe = new Map(recorridos.map((j) => [j.id, j.stageId]));
  const conteo = new Map<string, { hechas: number; total: number }>();
  for (const t of tareas) {
    if (!t.journeyId) continue;
    // Cuentan las tareas de la etapa actual y las sueltas (sin etapa); las de etapas anteriores, no.
    if (t.stageId !== null && t.stageId !== etapaDe.get(t.journeyId)) continue;
    const c = conteo.get(t.journeyId) ?? { hechas: 0, total: 0 };
    c.total++;
    if (t.doneAt) c.hechas++;
    conteo.set(t.journeyId, c);
  }

  const adaptador = adaptadorDe(TIPO_SUJETO);
  const nombres = adaptador ? await adaptador.nombre(workspaceId, recorridos.map((j) => j.subjectId)) : new Map<string, NombreDeSujeto>();

  const columnas: ColumnaVista[] = porEtapa.map(({ etapa, filas, total }) => ({
    etapa: { id: etapa.id, nombre: etapa.name, color: etapa.color, archivada: etapa.archivedAt !== null },
    total,
    masHref: total > filas.length ? `${RUTA_LISTA}?etapa=${encodeURIComponent(etapa.id)}` : null,
    tarjetas: filas.map((j) => ({
      journeyId: j.id,
      sujeto: nombres.get(j.subjectId) ?? { titulo: "Consulta sin datos", href: adaptador?.rutaFicha(j.subjectId) ?? RUTA_LISTA },
      diasEnEtapa: diasEnEtapaAR(j.enteredStageAt, ahora),
      vencida: estaVencida(j.stageDueAt, ahora),
      tareas: conteo.get(j.id) ?? { hechas: 0, total: 0 },
      enteredStageAt: j.enteredStageAt.toISOString(),
      responsableId: j.ownerUserId,
    })),
  }));

  return { circuito, columnas, ...base };
}
