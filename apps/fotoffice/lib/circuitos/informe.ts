import "server-only";
import { prisma } from "@repo/db";
import { NOTA_IMPORTADA, SALIDAS, type Clase } from "./constantes";

/**
 * Informe de un circuito en un período: cuánto tardan las consultas en cada etapa, cuántas
 * pasan por ella, cuántas se pierden desde ahí y por qué motivos. Todo acotado al workspace:
 * un circuito de otro workspace (o inexistente) devuelve null. El período (`desde`–`hasta`,
 * ambos incluidos) lo arma quien llama en hora de Buenos Aires (`resolverPeriodo`).
 *
 * Los pasos de la importación de consultas existentes (nota `NOTA_IMPORTADA`) no son
 * movimiento real: no cuentan en "pasaron", en el promedio de días (ni como salida ni como
 * la entrada desde la que se mide) ni en "perdidas desde acá". Sus cierres sí cuentan como
 * ganadas / perdidas (y su motivo) en el mes de su fecha histórica.
 */

export type EtapaInforme = {
  id: string;
  nombre: string;
  archivada: boolean;
  /** Promedio de (salida − entrada), en días con un decimal, de los pasos que salieron de la etapa en el período. */
  diasPromedio: number | null;
  /** Registros distintos que entraron a la etapa en el período. */
  pasaron: number;
  /** Cierres por fracaso (Perdida / Cancelado) que salieron de esta etapa en el período. */
  perdidasDesdeAca: number;
};

export type InformeCircuito = {
  etapas: EtapaInforme[];
  ganadas: number;
  perdidas: number;
  motivos: { nombre: string; cantidad: number }[];
};

const DIA_MS = 24 * 60 * 60 * 1000;
export const SIN_MOTIVO = "Sin motivo";

type Paso = {
  id: string;
  journeyId: string;
  fromStageId: string | null;
  toStageId: string | null;
  outcome: string | null;
  note: string | null;
  createdAt: Date;
};

/** Paso escrito por la importación de consultas existentes, no por un movimiento real. */
const esImportado = (p: Paso) => p.note === NOTA_IMPORTADA;

/** Entrada a una etapa: un paso que llega a una etapa distinta de la de origen (no un cambio de vencimiento). */
const esEntrada = (p: Paso) => p.toStageId !== null && p.fromStageId !== p.toStageId;
/** Salida de una etapa: un paso que la deja (a otra etapa o a un cierre). */
const esSalida = (p: Paso) => p.fromStageId !== null && p.fromStageId !== p.toStageId;

export async function informeCircuito(workspaceId: string, circuitId: string, desde: Date, hasta: Date): Promise<InformeCircuito | null> {
  const circuito = await prisma.fotofficeCircuit.findFirst({ where: { id: circuitId, workspaceId }, select: { id: true, kind: true } });
  if (!circuito) return null;
  const salidas = (SALIDAS as Record<string, { exito: string; fracaso: string } | undefined>)[circuito.kind] ?? SALIDAS.VENTA;
  const enPeriodo = (d: Date) => d.getTime() >= desde.getTime() && d.getTime() <= hasta.getTime();

  const selectPaso = { id: true, journeyId: true, fromStageId: true, toStageId: true, outcome: true, note: true, createdAt: true } as const;
  const [etapas, pasosPeriodo, cerradasPerdidas] = await Promise.all([
    prisma.fotofficeStage.findMany({
      where: { circuitId: circuito.id, circuit: { workspaceId } },
      select: { id: true, name: true, archivedAt: true },
      orderBy: [{ order: "asc" }],
    }),
    prisma.fotofficeJourneyStep.findMany({
      where: { createdAt: { gte: desde, lte: hasta }, journey: { workspaceId, circuitId: circuito.id } },
      select: selectPaso,
    }),
    prisma.fotofficeJourney.findMany({
      where: { workspaceId, circuitId: circuito.id, outcome: salidas.fracaso, closedAt: { gte: desde, lte: hasta } },
      select: { lossReasonId: true },
    }),
  ]);

  // Para medir cuánto estuvo en la etapa hace falta la entrada, que puede ser anterior al período.
  const conSalida = [...new Set(pasosPeriodo.filter((p) => esSalida(p) && !esImportado(p)).map((p) => p.journeyId))];
  const historia: Paso[] = conSalida.length
    ? await prisma.fotofficeJourneyStep.findMany({
        where: { journeyId: { in: conSalida }, createdAt: { lte: hasta }, journey: { workspaceId, circuitId: circuito.id } },
        select: selectPaso,
        orderBy: [{ journeyId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      })
    : [];

  const duraciones = new Map<string, number[]>();
  let actual: { journeyId: string; stageId: string; desde: Date; importada: boolean } | null = null;
  for (const p of historia) {
    if (actual && actual.journeyId !== p.journeyId) actual = null;
    // Una entrada importada no dice cuándo llegó de verdad a la etapa: esa estadía no se mide.
    if (esSalida(p) && !esImportado(p) && enPeriodo(p.createdAt) && actual && !actual.importada && actual.stageId === p.fromStageId) {
      const lista = duraciones.get(p.fromStageId!) ?? [];
      lista.push(p.createdAt.getTime() - actual.desde.getTime());
      duraciones.set(p.fromStageId!, lista);
    }
    if (esEntrada(p)) actual = { journeyId: p.journeyId, stageId: p.toStageId!, desde: p.createdAt, importada: esImportado(p) };
    else if (p.toStageId === null && p.fromStageId !== null) actual = null;
  }

  const entraron = new Map<string, Set<string>>();
  const perdidasDesde = new Map<string, number>();
  let ganadas = 0;
  let perdidas = 0;
  for (const p of pasosPeriodo) {
    if (esEntrada(p) && !esImportado(p)) {
      const s = entraron.get(p.toStageId!) ?? new Set<string>();
      s.add(p.journeyId);
      entraron.set(p.toStageId!, s);
    }
    if (p.toStageId === null && p.outcome === salidas.exito) ganadas++;
    if (p.toStageId === null && p.outcome === salidas.fracaso) {
      perdidas++;
      // Se sabe que se perdió, no desde qué etapa: el importado no suma a "perdidas desde acá".
      if (p.fromStageId && !esImportado(p)) perdidasDesde.set(p.fromStageId, (perdidasDesde.get(p.fromStageId) ?? 0) + 1);
    }
  }

  const promedio = (xs: number[] | undefined) =>
    xs && xs.length > 0 ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length / DIA_MS) * 10) / 10 : null;

  const filas: EtapaInforme[] = etapas
    .map((e) => ({
      id: e.id,
      nombre: e.name,
      archivada: e.archivedAt !== null,
      diasPromedio: promedio(duraciones.get(e.id)),
      pasaron: entraron.get(e.id)?.size ?? 0,
      perdidasDesdeAca: perdidasDesde.get(e.id) ?? 0,
    }))
    // Una etapa archivada sólo aparece si tuvo movimiento en el período.
    .filter((e) => !e.archivada || e.diasPromedio !== null || e.pasaron > 0 || e.perdidasDesdeAca > 0);

  const porMotivo = new Map<string | null, number>();
  for (const j of cerradasPerdidas) porMotivo.set(j.lossReasonId, (porMotivo.get(j.lossReasonId) ?? 0) + 1);
  const ids = [...porMotivo.keys()].filter((x): x is string => x !== null);
  const nombres = ids.length
    ? new Map(
        (await prisma.fotofficeLossReason.findMany({ where: { id: { in: ids }, workspaceId }, select: { id: true, name: true } })).map((m) => [
          m.id,
          m.name,
        ]),
      )
    : new Map<string, string>();
  const acumulado = new Map<string, number>();
  for (const [id, n] of porMotivo) {
    const nombre = id ? (nombres.get(id) ?? SIN_MOTIVO) : SIN_MOTIVO;
    acumulado.set(nombre, (acumulado.get(nombre) ?? 0) + n);
  }
  const motivos = [...acumulado]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"));

  return { etapas: filas, ganadas, perdidas, motivos };
}

/**
 * Circuitos activos de la clase (por omisión, venta) del workspace para elegir en el informe, y cuál se muestra: el
 * pedido si es suyo; si no, el predeterminado o el primero.
 */
export async function circuitosDelInforme(
  workspaceId: string,
  pedido: string | null,
  clase: Clase = "VENTA",
): Promise<{ circuitos: { id: string; nombre: string }[]; elegido: string | null }> {
  const filas = await prisma.fotofficeCircuit.findMany({
    where: { workspaceId, kind: clase, isActive: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ name: "asc" }],
  });
  const elegido = (pedido ? filas.find((c) => c.id === pedido) : undefined) ?? filas.find((c) => c.isDefault) ?? filas[0] ?? null;
  return { circuitos: filas.map((c) => ({ id: c.id, nombre: c.name })), elegido: elegido?.id ?? null };
}
