/**
 * Imputación de un cobro a las cuotas del pedido (etapa 3, Entrega A). Módulo PURO.
 *
 * Un cobro se reparte entre una o varias cuotas. Una cuota puede quedar con saldo, pero nunca se
 * imputa más que su saldo ni se crea una deuda nueva: si el cobro supera el saldo total, se rechaza
 * (para devolver plata se anula el cobro). Las cuentas van en centavos enteros.
 */

import { aCentavos, desdeCentavos, tieneHastaDosDecimales } from "./plan-cuotas";

/** Cuota con su saldo vigente (importe menos lo imputado por cobros sin anular). */
export type CuotaConSaldo = { id: string; position: number; dueDate: string; saldo: number };

export type Imputacion = { cuotaId: string; amountArs: number };

export type ResultadoImputacion = { ok: true; imputaciones: Imputacion[] } | { ok: false; error: string };

function importeValido(importe: number): boolean {
  return typeof importe === "number" && tieneHastaDosDecimales(importe) && aCentavos(importe) > 0;
}

/** De la más vieja a la más nueva: por vencimiento y, a igual vencimiento, por posición. */
function ordenar(cuotas: readonly CuotaConSaldo[]): CuotaConSaldo[] {
  return [...cuotas].sort((a, b) => (a.dueDate === b.dueDate ? a.position - b.position : a.dueDate < b.dueDate ? -1 : 1));
}

function saldoTotal(cuotas: readonly CuotaConSaldo[]): number {
  return cuotas.reduce((s, c) => s + Math.max(0, aCentavos(c.saldo)), 0);
}

/** Reparte el importe de la cuota más vieja a la más nueva. Rechaza si supera el saldo total. */
export function imputarAutomatico(cuotasConSaldo: readonly CuotaConSaldo[], importe: number): ResultadoImputacion {
  if (!importeValido(importe)) return { ok: false, error: "El importe tiene que ser mayor que cero." };
  let resto = aCentavos(importe);
  if (resto > saldoTotal(cuotasConSaldo)) {
    return { ok: false, error: "El importe supera el saldo del pedido." };
  }
  const imputaciones: Imputacion[] = [];
  for (const c of ordenar(cuotasConSaldo)) {
    if (resto === 0) break;
    const saldo = aCentavos(c.saldo);
    if (saldo <= 0) continue;
    const parte = Math.min(saldo, resto);
    imputaciones.push({ cuotaId: c.id, amountArs: desdeCentavos(parte) });
    resto -= parte;
  }
  return { ok: true, imputaciones };
}

/**
 * Valida una imputación a mano: cuotas del pedido, sin repetir, cada parte mayor que cero y no mayor
 * que el saldo de su cuota, y la suma igual al importe del cobro.
 */
export function validarImputacionManual(
  cuotasConSaldo: readonly CuotaConSaldo[],
  imputaciones: readonly Imputacion[],
  importe: number,
): ResultadoImputacion {
  if (!importeValido(importe)) return { ok: false, error: "El importe tiene que ser mayor que cero." };
  if (imputaciones.length === 0) return { ok: false, error: "Elegí al menos una cuota." };
  const porId = new Map(cuotasConSaldo.map((c) => [c.id, c]));
  const vistas = new Set<string>();
  let suma = 0;
  for (const imp of imputaciones) {
    const cuota = porId.get(imp.cuotaId);
    if (!cuota) return { ok: false, error: "Una de las cuotas no es de este pedido." };
    if (vistas.has(imp.cuotaId)) return { ok: false, error: `La cuota ${cuota.position} está repetida.` };
    vistas.add(imp.cuotaId);
    if (!importeValido(imp.amountArs)) {
      return { ok: false, error: `Lo imputado a la cuota ${cuota.position} tiene que ser mayor que cero.` };
    }
    if (aCentavos(imp.amountArs) > Math.max(0, aCentavos(cuota.saldo))) {
      return { ok: false, error: `Lo imputado a la cuota ${cuota.position} supera su saldo.` };
    }
    suma += aCentavos(imp.amountArs);
  }
  if (suma !== aCentavos(importe)) {
    return { ok: false, error: "Lo imputado a las cuotas tiene que sumar el importe del cobro." };
  }
  return {
    ok: true,
    imputaciones: imputaciones.map((i) => ({ cuotaId: i.cuotaId, amountArs: desdeCentavos(aCentavos(i.amountArs)) })),
  };
}
