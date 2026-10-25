import "server-only";
import type { Prisma, PrismaClient } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import type { FilaAnalitica } from "./analitica";
import { accionAlGuardar, datosDeLote, datosDeMovimientos, mapeosAprendidos, type AccionGuardar } from "./persistencia";
import type { ClaseHistorico, EstadoLote, LoteArmado, MotivoRevision, ResumenLote } from "./tipos";

/**
 * Lectura y escritura del histórico de Caja. Recibe el cliente de quien llama (la pantalla usa el
 * de siempre; el script de importación abre uno contra la base de FOTOFFICE).
 *
 * Nada de esto toca `CashMovement`: el histórico no cambia saldos, turnos ni arqueos.
 */
type Db = PrismaClient | Prisma.TransactionClient;

/** Guarda (o reemplaza) el lote del mes como BORRADOR. Idempotente: misma huella, nada que hacer. */
export async function guardarLoteBorrador(
  db: PrismaClient,
  entrada: { workspaceId: string; lote: LoteArmado; archivo: string; reemplazarConfirmado?: boolean },
): Promise<AccionGuardar> {
  const { workspaceId, lote } = entrada;
  return db.$transaction(async (tx) => {
    const existente = await tx.fotofficeHistoricoLote.findUnique({
      where: { workspaceId_mes: { workspaceId, mes: lote.mes } },
      select: { id: true, estado: true, huella: true },
    });
    const accion = accionAlGuardar(existente, lote.huella, entrada.reemplazarConfirmado ?? false);
    if (accion.accion === "sin-cambios" || accion.accion === "rechazar") return accion;
    const base = datosDeLote(lote, entrada.archivo);
    const datos = { ...base, resumen: base.resumen as unknown as Prisma.InputJsonValue };
    let loteId: string;
    if (existente) {
      await tx.fotofficeHistoricoMovimiento.deleteMany({ where: { workspaceId, loteId: existente.id } });
      await tx.fotofficeHistoricoLote.update({ where: { id: existente.id }, data: datos });
      loteId = existente.id;
    } else {
      loteId = (await tx.fotofficeHistoricoLote.create({ data: { ...datos, workspaceId }, select: { id: true } })).id;
    }
    await tx.fotofficeHistoricoMovimiento.createMany({ data: datosDeMovimientos(lote, workspaceId, loteId) });
    return accion;
  }, { timeout: 60_000 });
}

/** Confirma el mes: desde ahora lo suman los informes. Guarda el mapeo usado para la próxima vez. */
export async function confirmarLote(db: PrismaClient, entrada: { workspaceId: string; mes: string; userId: number | null }): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const lote = await tx.fotofficeHistoricoLote.findUnique({
      where: { workspaceId_mes: { workspaceId: entrada.workspaceId, mes: entrada.mes } },
      select: { id: true, estado: true },
    });
    if (!lote || lote.estado !== "BORRADOR") return false;
    await tx.fotofficeHistoricoLote.update({
      where: { id: lote.id },
      data: { estado: "CONFIRMADO", confirmadoAt: new Date(), confirmadoPorUserId: entrada.userId },
    });
    const movs = await tx.fotofficeHistoricoMovimiento.findMany({
      where: { workspaceId: entrada.workspaceId, loteId: lote.id, regla: { not: null } },
      distinct: ["regla"],
      select: { regla: true, clase: true, rubroCodigo: true, rubroNombre: true, estimado: true },
    });
    for (const m of mapeosAprendidos(movs.map((x) => ({ ...x, clase: x.clase as ClaseHistorico })))) {
      const { clave, ...resto } = m;
      await tx.fotofficeHistoricoMapeo.upsert({
        where: { workspaceId_clave: { workspaceId: entrada.workspaceId, clave } },
        create: { workspaceId: entrada.workspaceId, clave, ...resto },
        update: resto,
      });
    }
    return true;
  });
}

/** Descarta el mes (no se borra: re-importarlo lo vuelve a BORRADOR). Los informes dejan de sumarlo. */
export async function descartarLote(db: Db, entrada: { workspaceId: string; mes: string }): Promise<boolean> {
  const r = await db.fotofficeHistoricoLote.updateMany({
    where: { workspaceId: entrada.workspaceId, mes: entrada.mes, estado: { in: ["BORRADOR", "CONFIRMADO"] } },
    data: { estado: "DESCARTADO", confirmadoAt: null, confirmadoPorUserId: null },
  });
  return r.count > 0;
}

export type LoteListado = {
  mes: string;
  estado: EstadoLote;
  archivo: string;
  filas: number;
  filasRevisar: number;
  ingresosCentavos: number;
  egresosCentavos: number;
  estimadosCentavos: number;
  avisos: string[];
  resumen: ResumenLote;
  confirmadoAt: Date | null;
};

const SELECT_LOTE = {
  mes: true, estado: true, archivo: true, filas: true, filasRevisar: true, ingresosArs: true, egresosArs: true,
  estimadosArs: true, avisos: true, resumen: true, confirmadoAt: true,
} as const;

type FilaLote = Prisma.FotofficeHistoricoLoteGetPayload<{ select: typeof SELECT_LOTE }>;

function aListado(l: FilaLote): LoteListado {
  return {
    mes: l.mes,
    estado: l.estado as EstadoLote,
    archivo: l.archivo,
    filas: l.filas,
    filasRevisar: l.filasRevisar,
    ingresosCentavos: decimalArsToMinor(l.ingresosArs),
    egresosCentavos: decimalArsToMinor(l.egresosArs),
    estimadosCentavos: decimalArsToMinor(l.estimadosArs),
    avisos: l.avisos,
    resumen: l.resumen as unknown as ResumenLote,
    confirmadoAt: l.confirmadoAt,
  };
}

export async function listarLotes(db: Db, workspaceId: string): Promise<LoteListado[]> {
  const filas = await db.fotofficeHistoricoLote.findMany({ where: { workspaceId }, orderBy: { mes: "desc" }, select: SELECT_LOTE });
  return filas.map(aListado);
}

export type MovimientoParaRevisar = {
  fecha: string;
  concepto: string;
  centavos: number;
  rubro: string | null;
  motivos: MotivoRevision[];
  referencia: string | null;
};

export async function leerLote(
  db: Db,
  workspaceId: string,
  mes: string,
  limite = 300,
): Promise<{ lote: LoteListado; revisar: MovimientoParaRevisar[]; totalRevisar: number } | null> {
  const fila = await db.fotofficeHistoricoLote.findUnique({ where: { workspaceId_mes: { workspaceId, mes } }, select: SELECT_LOTE });
  if (!fila) return null;
  const lote = aListado(fila);
  const filas = await db.fotofficeHistoricoMovimiento.findMany({
    where: { workspaceId, lote: { workspaceId, mes }, revisar: true },
    orderBy: { orden: "asc" },
    take: limite,
    select: { fecha: true, conceptoOriginal: true, importeArs: true, rubroCodigo: true, rubroNombre: true, motivosRevision: true, referenciaOrigen: true },
  });
  return {
    lote,
    totalRevisar: lote.filasRevisar,
    revisar: filas.map((f) => ({
      fecha: f.fecha.toISOString().slice(0, 10),
      concepto: f.conceptoOriginal,
      centavos: decimalArsToMinor(f.importeArs),
      rubro: f.rubroCodigo ? `${f.rubroCodigo} ${f.rubroNombre ?? ""}`.trim() : null,
      motivos: f.motivosRevision as MotivoRevision[],
      referencia: f.referenciaOrigen,
    })),
  };
}

/**
 * Filas para la analítica: sólo lotes CONFIRMADOS, agrupadas por mes, clase, rubro y estimado.
 * Además, los meses con avisos (p. ej. gastos fijos incompletos).
 */
export async function filasAnaliticasConfirmadas(
  db: Db,
  workspaceId: string,
): Promise<{ filas: FilaAnalitica[]; mesesConAvisos: Set<string> }> {
  const lotes = await db.fotofficeHistoricoLote.findMany({
    where: { workspaceId, estado: "CONFIRMADO" },
    select: { id: true, mes: true, avisos: true },
  });
  if (lotes.length === 0) return { filas: [], mesesConAvisos: new Set() };
  const mesDeLote = new Map(lotes.map((l) => [l.id, l.mes]));
  const grupos = await db.fotofficeHistoricoMovimiento.groupBy({
    by: ["loteId", "clase", "rubroCodigo", "rubroNombre", "estimado"],
    where: { workspaceId, loteId: { in: lotes.map((l) => l.id) } },
    _sum: { importeArs: true },
  });
  return {
    filas: grupos.map((g) => ({
      mes: mesDeLote.get(g.loteId)!,
      clase: g.clase as ClaseHistorico,
      rubroCodigo: g.rubroCodigo,
      rubroNombre: g.rubroNombre,
      centavos: g._sum.importeArs ? decimalArsToMinor(g._sum.importeArs) : 0,
      estimado: g.estimado,
    })),
    mesesConAvisos: new Set(lotes.filter((l) => l.avisos.length > 0).map((l) => l.mes)),
  };
}
