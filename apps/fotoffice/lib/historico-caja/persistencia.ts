/**
 * Cómo se guarda un lote del histórico. Módulo PURO: decide y arma los datos; `repositorio.ts`
 * los escribe.
 */
import { minorToDecimalString } from "@/lib/membership/money";
import type { ClaseHistorico, EstadoLote, LoteArmado, MovimientoHistorico } from "./tipos";

export type AccionGuardar =
  | { accion: "crear" }
  | { accion: "reemplazar" }
  | { accion: "sin-cambios" }
  | { accion: "rechazar"; motivo: string };

/**
 * Re-importar un mes reemplaza su lote. Si el contenido es el mismo, no se toca (idempotente).
 * Un lote CONFIRMADO ya se usa en los informes: reemplazarlo tiene que ser a propósito.
 */
export function accionAlGuardar(
  existente: { estado: string; huella: string } | null,
  huella: string,
  reemplazarConfirmado: boolean,
): AccionGuardar {
  if (!existente) return { accion: "crear" };
  if (existente.huella === huella && existente.estado !== "DESCARTADO") return { accion: "sin-cambios" };
  if (existente.estado === "CONFIRMADO" && !reemplazarConfirmado) {
    return { accion: "rechazar", motivo: "El mes ya está confirmado. Para reemplazarlo, usá --reemplazar-confirmado." };
  }
  return { accion: "reemplazar" };
}

export function datosDeLote(lote: LoteArmado, archivo: string) {
  const r = lote.resumen;
  return {
    mes: lote.mes,
    estado: "BORRADOR" as EstadoLote,
    archivo,
    huella: lote.huella,
    filas: r.filas,
    ingresosArs: minorToDecimalString(r.ingresosCentavos),
    egresosArs: minorToDecimalString(r.egresosLibroCentavos),
    estimadosArs: minorToDecimalString(r.estimadosCentavos),
    filasRevisar: r.filasRevisar,
    resumen: r,
    avisos: r.avisos,
    confirmadoAt: null,
    confirmadoPorUserId: null,
  };
}

export function datosDeMovimientos(lote: LoteArmado, workspaceId: string, loteId: string) {
  return lote.movimientos.map((m) => ({
    workspaceId,
    loteId,
    orden: m.orden,
    fecha: new Date(`${m.fecha}T00:00:00.000Z`),
    turno: m.turno,
    medio: m.medio,
    conceptoOriginal: m.conceptoOriginal,
    conceptoNormalizado: m.conceptoNormalizado,
    importeArs: minorToDecimalString(m.centavos),
    clase: m.clase,
    rubroCodigo: m.rubroCodigo,
    rubroNombre: m.rubroNombre,
    regla: m.regla,
    origen: m.origen,
    estimado: m.estimado,
    revisar: m.motivos.length > 0,
    motivosRevision: m.motivos,
    referenciaOrigen: m.referencia,
    filaOrigen: m.fila,
    observacion: m.observacion,
  }));
}

export function parsearClave(clave: string): { concepto: string; signo: "+" | "-" | null; montoMinimo: number | null } {
  const partes = clave.split("|");
  const monto = Number(partes.pop());
  const signo = partes.pop();
  return { concepto: partes.join("|"), signo: signo === "+" || signo === "-" ? signo : null, montoMinimo: monto > 0 ? monto : null };
}

/** Lo que se aprende al confirmar: una fila por regla usada (sin estimados ni sin clasificar). */
export function mapeosAprendidos(movs: readonly Pick<MovimientoHistorico, "regla" | "clase" | "rubroCodigo" | "rubroNombre" | "estimado">[]) {
  const out = new Map<string, { clave: string; concepto: string; signo: "+" | "-" | null; montoMinimoArs: string | null; clase: ClaseHistorico; rubroCodigo: string; rubroNombre: string }>();
  for (const m of movs) {
    if (m.estimado || !m.regla || m.clase === "SIN_CLASIFICAR" || !m.rubroCodigo || out.has(m.regla)) continue;
    const p = parsearClave(m.regla);
    out.set(m.regla, {
      clave: m.regla,
      concepto: p.concepto,
      signo: p.signo,
      montoMinimoArs: p.montoMinimo === null ? null : minorToDecimalString(Math.round(p.montoMinimo * 100)),
      clase: m.clase,
      rubroCodigo: m.rubroCodigo,
      rubroNombre: m.rubroNombre ?? m.rubroCodigo,
    });
  }
  return [...out.values()];
}
