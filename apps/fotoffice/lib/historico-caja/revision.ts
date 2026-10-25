/**
 * Motivos para revisar una fila antes de confirmar el mes. Módulo PURO.
 *
 * Mira toda la importación a la vez (no un mes suelto): "monto fuera de lo común" y "posible
 * duplicado" necesitan comparar contra los otros meses.
 */
import type { Clasificacion } from "./mapeo";
import { CLASES_EGRESO, type ClaseHistorico, type FilaCsv, type MotivoRevision } from "./tipos";

const EGRESOS = new Set<ClaseHistorico>(CLASES_EGRESO);

export type OpcionesRevision = {
  /** Desde qué importe (centavos, en valor absoluto) se buscan duplicados. */
  umbralDuplicadoCentavos?: number;
  ventanaDuplicadoDias?: number;
  /** Veces la mediana del concepto a partir de las cuales un monto es "fuera de lo común". */
  factorInusual?: number;
  /** Filas mínimas de un concepto para opinar sobre su mediana. */
  muestraMinima?: number;
};

const CONCEPTOS_SIN_TEXTO = new Set(["", "(SIN CONCEPTO)"]);

function dias(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(v.length / 2);
  return v.length % 2 ? v[mitad] : (v[mitad - 1] + v[mitad]) / 2;
}

export function motivosDeRevision(
  filas: readonly (Pick<FilaCsv, "fecha" | "conceptoNormalizado" | "centavos" | "observacion"> & { clasificacion: Clasificacion })[],
  opciones: OpcionesRevision = {},
): MotivoRevision[][] {
  const umbral = opciones.umbralDuplicadoCentavos ?? 100_000_00;
  const ventana = opciones.ventanaDuplicadoDias ?? 45;
  const factor = opciones.factorInusual ?? 10;
  const muestra = opciones.muestraMinima ?? 10;

  const motivos: MotivoRevision[][] = filas.map((f) => {
    const out: MotivoRevision[] = [];
    const c = f.clasificacion;
    if (c.confianza === "baja") out.push("CONFIANZA_BAJA");
    if (c.clase === "INGRESO" && f.centavos < 0) out.push("SIGNO_CONTRARIO");
    if (EGRESOS.has(c.clase) && f.centavos > 0) out.push("SIGNO_CONTRARIO");
    if (CONCEPTOS_SIN_TEXTO.has(f.conceptoNormalizado) || (f.observacion ?? "").includes("monto_sin_texto")) out.push("SIN_CONCEPTO");
    if (c.clase === "SIN_CLASIFICAR") out.push("SIN_REGLA");
    return out;
  });

  // Monto fuera de lo común: |importe| > factor × mediana de su concepto (mismo signo).
  const porConcepto = new Map<string, number[]>();
  filas.forEach((f, i) => {
    const k = `${f.conceptoNormalizado}|${Math.sign(f.centavos)}`;
    porConcepto.set(k, [...(porConcepto.get(k) ?? []), i]);
  });
  for (const indices of porConcepto.values()) {
    if (indices.length < muestra) continue;
    const med = mediana(indices.map((i) => Math.abs(filas[i].centavos)));
    for (const i of indices) {
      if (Math.abs(filas[i].centavos) > factor * med) motivos[i].push("MONTO_INUSUAL");
    }
  }

  // Posible duplicado: mismo concepto e importe (grande) en `ventana` días o menos.
  const grandes = new Map<string, number[]>();
  filas.forEach((f, i) => {
    if (Math.abs(f.centavos) < umbral) return;
    const k = `${f.conceptoNormalizado}|${f.centavos}`;
    grandes.set(k, [...(grandes.get(k) ?? []), i]);
  });
  for (const indices of grandes.values()) {
    for (const i of indices) {
      const cerca = indices.some((j) => j !== i && Math.abs(dias(filas[j].fecha) - dias(filas[i].fecha)) <= ventana);
      if (cerca) motivos[i].push("POSIBLE_DUPLICADO");
    }
  }
  return motivos;
}
