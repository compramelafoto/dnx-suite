/**
 * Histórico de Caja (etapa E, spec 7.6). Tipos y constantes. Módulo PURO.
 *
 * El histórico NO es Caja: vive en tablas aparte (`FotofficeHistoricoLote` y
 * `FotofficeHistoricoMovimiento`), no toca saldos, turnos ni arqueos. Sirve para mirar el pasado
 * (resultados, promedio de fijos, tablero del estudio) y se carga mes por mes, con revisión.
 */

/**
 * Clase de un movimiento histórico. Sale del código de rubro (spec 7.1):
 * `3…` ingreso (los hijos son las líneas de negocio), `4…` costo variable, `5…` gasto fijo,
 * `6…` retiro del dueño, `0…` movimiento interno (no es ingreso ni gasto: plata que cambia de lugar).
 */
export const CLASES_HISTORICO = [
  "INGRESO",
  "COSTO_VARIABLE",
  "GASTO_FIJO",
  "RETIRO_DUENO",
  "MOVIMIENTO_INTERNO",
  "SIN_CLASIFICAR",
] as const;
export type ClaseHistorico = (typeof CLASES_HISTORICO)[number];

export const ETIQUETA_CLASE: Record<ClaseHistorico, string> = {
  INGRESO: "Ingresos",
  COSTO_VARIABLE: "Costos variables",
  GASTO_FIJO: "Gastos fijos",
  RETIRO_DUENO: "Retiro del dueño",
  MOVIMIENTO_INTERNO: "Movimientos internos",
  SIN_CLASIFICAR: "Sin clasificar",
};

/** Clases que son egresos del negocio (entran en el resultado, salvo el retiro, que va debajo). */
export const CLASES_EGRESO = ["COSTO_VARIABLE", "GASTO_FIJO", "RETIRO_DUENO"] as const;

export const ESTADOS_LOTE = ["BORRADOR", "CONFIRMADO", "DESCARTADO"] as const;
export type EstadoLote = (typeof ESTADOS_LOTE)[number];

/** De dónde salió la fila: el CSV del libro, un extracto de banco (futuro) o un estimado. */
export const ORIGENES_HISTORICO = ["CSV", "EXTRACTO", "ESTIMADO"] as const;
export type OrigenHistorico = (typeof ORIGENES_HISTORICO)[number];

export const MOTIVOS_REVISION = [
  "CONFIANZA_BAJA",
  "SIGNO_CONTRARIO",
  "SIN_CONCEPTO",
  "SIN_REGLA",
  "MONTO_INUSUAL",
  "POSIBLE_DUPLICADO",
] as const;
export type MotivoRevision = (typeof MOTIVOS_REVISION)[number];

export const ETIQUETA_MOTIVO: Record<MotivoRevision, string> = {
  CONFIANZA_BAJA: "Clasificación dudosa",
  SIGNO_CONTRARIO: "Signo al revés (¿devolución o error de carga?)",
  SIN_CONCEPTO: "Monto sin concepto",
  SIN_REGLA: "Concepto sin clasificar",
  MONTO_INUSUAL: "Monto fuera de lo común para ese concepto",
  POSIBLE_DUPLICADO: "Posible duplicado",
};

export type Medio = "EFECTIVO" | "DIGITAL";

/** Una fila del CSV normalizado, ya leída. Importe en centavos con signo (+ entra, − sale). */
export type FilaCsv = {
  /** Número de línea en el archivo (el encabezado es la 1). */
  fila: number;
  /** "AAAA-MM-DD". */
  fecha: string;
  turno: string | null;
  medio: Medio | null;
  conceptoOriginal: string;
  conceptoNormalizado: string;
  centavos: number;
  /** Dónde está en la planilla original: "archivo | pestaña | celda". */
  referencia: string | null;
  observacion: string | null;
};

/** Un movimiento histórico listo para guardar. */
export type MovimientoHistorico = Omit<FilaCsv, "fila"> & {
  /** Línea del CSV; `null` en los estimados. */
  fila: number | null;
  /** Posición dentro del lote. */
  orden: number;
  clase: ClaseHistorico;
  rubroCodigo: string | null;
  rubroNombre: string | null;
  /** Clave de la regla de mapeo que lo clasificó. */
  regla: string | null;
  origen: OrigenHistorico;
  estimado: boolean;
  motivos: MotivoRevision[];
};

export type TotalRubro = {
  codigo: string | null;
  nombre: string;
  clase: ClaseHistorico;
  centavos: number;
  cantidad: number;
  estimadoCentavos: number;
};

export type Faltante = { concepto: string; rubroCodigo: string | null; rubroNombre: string | null; mesesVistos: number };

/** Lo que se muestra para revisar un mes antes de confirmarlo. Se guarda como JSON en el lote. */
export type ResumenLote = {
  mes: string;
  /** Filas del CSV (sin estimados). */
  filas: number;
  filasRevisar: number;
  ingresosCentavos: number;
  ingresosEfectivoCentavos: number;
  ingresosDigitalCentavos: number;
  porClase: Record<ClaseHistorico, number>;
  porRubro: TotalRubro[];
  /** Egresos 4…, 5… y 6… que vinieron del libro (sin estimados). */
  egresosLibroCentavos: number;
  estimados: { concepto: string; rubroCodigo: string | null; centavos: number }[];
  estimadosCentavos: number;
  /** Ingresos + costos variables + gastos fijos + sin clasificar. El retiro va debajo; los internos no cuentan. */
  resultadoCentavos: number;
  avisos: string[];
  faltantes: Faltante[];
};

export type LoteArmado = {
  mes: string;
  movimientos: MovimientoHistorico[];
  resumen: ResumenLote;
  /** sha-256 del contenido: misma entrada, misma huella. */
  huella: string;
};

/** "AAAA-MM" de un "AAAA-MM-DD". */
export function mesDeFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

export function esMes(texto: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);
}

/** Suma `n` meses a "AAAA-MM" (n puede ser negativo). */
export function sumarMeses(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
