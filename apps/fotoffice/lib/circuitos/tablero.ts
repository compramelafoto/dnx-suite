import "server-only";
import { prisma } from "@repo/db";
import { suspendidosEntre } from "@/lib/proyectos/proyectos";
import { hoyEnBuenosAires } from "../listado/periodos";
import { estaVencida } from "./calculos";
import { SALIDAS, type Clase, type TipoSujeto } from "./constantes";
import { adaptadorDe, type NombreDeSujeto } from "./sujetos";
import { numeroDe } from "../numeracion/asignar";
import { TIPO_CONSULTA } from "../service-leads/numero";
import { fechaDeEvento } from "../ficha/formato";
import { sumarValores, valorComoNumero } from "../consultas/valor";
import { esGrupoConsulta, grupoPide } from "../consultas/constantes";

/**
 * Datos del tablero de Captación. Todo se lee acotado al workspace de la sesión: el circuito
 * elegido tiene que ser suyo (si no, se usa el predeterminado) y los recorridos, tareas,
 * motivos y responsables se filtran por `workspaceId`.
 */

/** Tarjetas por columna. Pasado el tope, la columna ofrece "y N más" hacia el Modo lista. */
export const TOPE_POR_COLUMNA = 300;
/** Qué tablero es: el tipo de registro y la clase de circuitos. Por omisión, el de Captación (Consultas). */
export type OpcionesTablero = { tipoSujeto?: TipoSujeto; clase?: Clase };
const POR_OMISION = { tipoSujeto: "CAPTACION", clase: "VENTA" } as const satisfies Required<OpcionesTablero>;
/** Tipo de número (`FotofficeRecordNumber.entityType`) de cada tipo de registro. */
const tipoDeNumeroDe = (tipo: TipoSujeto): string | undefined => (tipo === "CAPTACION" ? TIPO_CONSULTA : tipo === "PROYECTO" ? "PROYECTO" : undefined);
const SIN_DATOS: Partial<Record<TipoSujeto, string>> = { PROYECTO: "Proyecto sin datos" };
const DIA_MS = 24 * 60 * 60 * 1000;
/** Ids por lectura de valores: muy por debajo del tope de parámetros de Postgres. */
const LOTE_DE_IDS = 5000;

export type TarjetaVista = {
  journeyId: string;
  sujeto: NombreDeSujeto;
  /** Número de la consulta ("2026-0042"); null si todavía no tiene. */
  numero: string | null;
  diasEnEtapa: number;
  vencida: boolean;
  tareas: { hechas: number; total: number };
  /** ISO: vuelve tal cual como `esperado` al mover o cerrar. */
  enteredStageAt: string;
  responsableId: number | null;
  /** Datos de la etapa 1 (null si la consulta no tiene ficha nueva): categoría, día del evento y valor. */
  categoria: string | null;
  /** "20/12/2026" con el ayudante de fecha de calendario (`fechaDeEvento`). */
  fechaEvento: string | null;
  valor: number | null;
};

export type EtapaVista = { id: string; nombre: string; color: string; archivada: boolean };
/** `valorTotal`: suma del valor estimado de TODAS las consultas de la columna (también las que no se dibujan). */
export type ColumnaVista = { etapa: EtapaVista; tarjetas: TarjetaVista[]; total: number; valorTotal: number; masHref: string | null };
/** `predeterminado`: el circuito donde entran las consultas nuevas (ahí va el alta rápida). */
export type CircuitoVista = { id: string; nombre: string; clase: Clase; predeterminado: boolean };

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

type DatosConsulta = { categoria: string | null; fechaEvento: string | null; valor: number | null };

/**
 * Categoría, día del evento y valor de estas consultas del workspace. En tandas de `LOTE_DE_IDS`
 * (una columna puede tener más tarjetas de las que se dibujan, y el total las suma a todas).
 */
async function datosDeConsultas(workspaceId: string, leadIds: string[]): Promise<Map<string, DatosConsulta>> {
  const mapa = new Map<string, DatosConsulta>();
  const unicos = [...new Set(leadIds)];
  if (unicos.length === 0) return mapa;
  const filas: { leadId: string; categoryId: string; estimatedValue: unknown; eventStartsAt: Date | null }[] = [];
  for (let i = 0; i < unicos.length; i += LOTE_DE_IDS) {
    filas.push(
      ...(await prisma.fotofficeConsulta.findMany({
        where: { workspaceId, leadId: { in: unicos.slice(i, i + LOTE_DE_IDS) } },
        select: { leadId: true, categoryId: true, estimatedValue: true, eventStartsAt: true },
      })),
    );
  }
  const categorias = filas.length
    ? await prisma.fotofficeConsultaCategoria.findMany({ where: { workspaceId }, select: { id: true, name: true, group: true } })
    : [];
  const categoria = new Map(categorias.map((c) => [c.id, c]));
  for (const f of filas) {
    const c = categoria.get(f.categoryId);
    // Regla R11: si el grupo de la categoría no pide fecha, el día que quedó guardado no se muestra.
    const pideFecha = !c || !esGrupoConsulta(c.group) || grupoPide(c.group, "fechaHora");
    mapa.set(f.leadId, {
      categoria: c?.name ?? null,
      fechaEvento: f.eventStartsAt && pideFecha ? fechaDeEvento(f.eventStartsAt) : null,
      valor: valorComoNumero(f.estimatedValue as { toString(): string } | null),
    });
  }
  return mapa;
}

/** Mismo criterio que `etiquetaDeUsuario` (lib/listado/acceso), sin arrastrar la sesión. */
function nombreDeUsuario(u: { id: number; name?: string | null; email?: string | null } | null | undefined, id: number): string {
  return u?.name?.trim() || u?.email?.trim() || `Usuario ${id}`;
}

/** Motivos de pérdida activos del workspace, en su orden. */
export async function motivosActivos(workspaceId: string): Promise<{ id: string; nombre: string }[]> {
  const motivos = await prisma.fotofficeLossReason.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return motivos.map((m) => ({ id: m.id, nombre: m.name }));
}

/** Miembros del workspace, por nombre: los que pueden ser responsables de un recorrido. */
export async function responsablesDe(workspaceId: string): Promise<{ id: number; nombre: string }[]> {
  const miembros = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { userId: "asc" },
  });
  return miembros
    .map((m) => ({ id: m.userId, nombre: nombreDeUsuario(m.user, m.userId) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

async function elegirCircuito(workspaceId: string, circuitoId: string | null, CLASE: Clase) {
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
  const vista = (c: (typeof circuitos)[number]): CircuitoVista => ({ id: c.id, nombre: c.name, clase: CLASE, predeterminado: c.isDefault });
  return { circuito: elegido ? vista(elegido) : null, circuitos: circuitos.map(vista) };
}

/** Ids de los proyectos suspendidos que tienen un recorrido abierto en este flujo. */
async function suspendidosDelFlujo(workspaceId: string, circuitId: string): Promise<Set<string>> {
  const abiertos = await prisma.fotofficeJourney.findMany({
    where: { workspaceId, circuitId, subjectType: "PROYECTO", closedAt: null },
    select: { subjectId: true },
  });
  return suspendidosEntre(workspaceId, abiertos.map((j) => j.subjectId));
}

export async function cargarTablero(
  ctx: { workspaceId: string },
  circuitoId: string | null,
  filtros: FiltrosTablero,
  ahora: Date,
  opciones: OpcionesTablero = {},
): Promise<Tablero> {
  const { workspaceId } = ctx;
  const TIPO_SUJETO = opciones.tipoSujeto ?? POR_OMISION.tipoSujeto;
  const CLASE = opciones.clase ?? POR_OMISION.clase;
  const esCaptacion = TIPO_SUJETO === "CAPTACION";
  const [{ circuito, circuitos }, motivos, responsables] = await Promise.all([
    elegirCircuito(workspaceId, circuitoId, CLASE),
    motivosActivos(workspaceId),
    responsablesDe(workspaceId),
  ]);

  const base = { circuitos, salidas: SALIDAS[CLASE], motivos, responsables };
  if (!circuito) return { circuito: null, columnas: [], ...base };

  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: circuito.id, circuit: { workspaceId } },
    select: { id: true, name: true, color: true, order: true, archivedAt: true },
    orderBy: [{ order: "asc" }],
  });

  // Un proyecto suspendido no cuenta como vencido: ni se marca ni entra en "sólo vencidas".
  const suspendidos = TIPO_SUJETO === "PROYECTO" ? await suspendidosDelFlujo(workspaceId, circuito.id) : new Set<string>();
  const where = {
    workspaceId,
    circuitId: circuito.id,
    subjectType: TIPO_SUJETO,
    closedAt: null,
    ...(filtros.responsable !== undefined ? { ownerUserId: filtros.responsable } : {}),
    ...(filtros.soloVencidas
      ? { stageDueAt: { lt: ahora }, ...(suspendidos.size > 0 ? { subjectId: { notIn: [...suspendidos] } } : {}) }
      : {}),
  };
  // Un solo conteo por etapa (con los filtros) para toda la pantalla.
  const grupos = await prisma.fotofficeJourney.groupBy({ by: ["stageId"], where, _count: true });
  const totalDe = new Map(grupos.map((g) => [g.stageId, g._count]));
  // Una etapa archivada aparece (al final) mientras tenga recorridos abiertos que coincidan con
  // los filtros, para poder sacarlos de ahí; no recibe movimientos nuevos.
  const visibles = [
    ...etapas.filter((e) => e.archivedAt === null),
    ...etapas.filter((e) => e.archivedAt !== null && (totalDe.get(e.id) ?? 0) > 0),
  ];

  const porEtapa = await Promise.all(
    visibles.map(async (e) => {
      const total = totalDe.get(e.id) ?? 0;
      const filas =
        total === 0
          ? []
          : await prisma.fotofficeJourney.findMany({
              where: { ...where, stageId: e.id },
              select: { id: true, subjectType: true, subjectId: true, stageId: true, enteredStageAt: true, stageDueAt: true, ownerUserId: true },
              orderBy: [{ enteredStageAt: "asc" }, { id: "asc" }],
              take: TOPE_POR_COLUMNA,
            });
      return { etapa: e, filas, total };
    }),
  );

  // Todas las consultas abiertas del circuito (con los filtros), para el total de valor por columna.
  const todos = await prisma.fotofficeJourney.findMany({ where, select: { stageId: true, subjectId: true } });
  // Categoría, día del evento y valor son datos de la consulta: otros tipos no los tienen.
  const datos = esCaptacion ? await datosDeConsultas(workspaceId, todos.map((j) => j.subjectId)) : new Map<string, DatosConsulta>();
  const valoresPorEtapa = new Map<string | null, (number | null)[]>();
  for (const j of todos) {
    const lista = valoresPorEtapa.get(j.stageId) ?? [];
    lista.push(datos.get(j.subjectId)?.valor ?? null);
    valoresPorEtapa.set(j.stageId, lista);
  }

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
  const rutaLista = `${adaptador?.rutaTablero ?? "/consultas"}/lista`;
  const tipoDeNumero = tipoDeNumeroDe(TIPO_SUJETO);
  const sujetos = recorridos.map((j) => j.subjectId);
  // Nombres y números de todo el tablero en una lectura cada uno.
  const [nombres, numeros] = await Promise.all([
    adaptador ? adaptador.nombre(workspaceId, sujetos) : new Map<string, NombreDeSujeto>(),
    tipoDeNumero ? numeroDe(workspaceId, tipoDeNumero, sujetos) : Promise.resolve(new Map<string, string>()),
  ]);

  const columnas: ColumnaVista[] = porEtapa.map(({ etapa, filas, total }) => ({
    etapa: { id: etapa.id, nombre: etapa.name, color: etapa.color, archivada: etapa.archivedAt !== null },
    total,
    valorTotal: sumarValores(valoresPorEtapa.get(etapa.id) ?? []),
    masHref: total > filas.length ? `${rutaLista}?etapa=${encodeURIComponent(etapa.id)}` : null,
    tarjetas: filas.map((j) => ({
      journeyId: j.id,
      sujeto: nombres.get(j.subjectId) ?? { titulo: SIN_DATOS[TIPO_SUJETO] ?? "Consulta sin datos", href: adaptador?.rutaFicha(j.subjectId) ?? rutaLista },
      numero: numeros.get(j.subjectId) ?? null,
      diasEnEtapa: diasEnEtapaAR(j.enteredStageAt, ahora),
      vencida: estaVencida(j.stageDueAt, ahora) && !suspendidos.has(j.subjectId),
      tareas: conteo.get(j.id) ?? { hechas: 0, total: 0 },
      enteredStageAt: j.enteredStageAt.toISOString(),
      responsableId: j.ownerUserId,
      categoria: datos.get(j.subjectId)?.categoria ?? null,
      fechaEvento: datos.get(j.subjectId)?.fechaEvento ?? null,
      valor: datos.get(j.subjectId)?.valor ?? null,
    })),
  }));

  return { circuito, columnas, ...base };
}
