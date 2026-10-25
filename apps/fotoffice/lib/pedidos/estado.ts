/**
 * Estados del pedido y de sus cuotas (etapa 3, Entrega A). Módulo PURO: sin base y sin reloj
 * (quien llama pasa `hoy` = el día de Argentina, "aaaa-mm-dd").
 *
 * Pedido (a mano): CONFIRMADO → EN_CURSO → COMPLETADO. CANCELADO desde cualquiera salvo
 * COMPLETADO, con motivo; de CANCELADO no se vuelve.
 *
 * Cuotas: el estado no se guarda, se calcula al leer con las imputaciones de cobros SIN anular:
 * - PAGADA: saldo 0;
 * - CANCELADA: el pedido está cancelado y la cuota tiene saldo;
 * - VENCIDA: tiene saldo y el vencimiento es anterior a hoy;
 * - PARCIAL: tiene algo imputado y saldo, sin vencer;
 * - PENDIENTE: nada imputado, sin vencer.
 *
 * Las cuentas van en centavos enteros; lo que sale, en pesos con dos decimales.
 */

import type { EstadoCuota, EstadoPedido } from "./constantes";
import { aCentavos, desdeCentavos } from "./plan-cuotas";

// --- Pedido -----------------------------------------------------------------------------------

const TRANSICIONES: Record<EstadoPedido, readonly EstadoPedido[]> = {
  CONFIRMADO: ["EN_CURSO", "CANCELADO"],
  EN_CURSO: ["COMPLETADO", "CANCELADO"],
  COMPLETADO: [],
  CANCELADO: [],
};

/** ¿Se puede pasar el pedido de `de` a `a` a mano? */
export function puedePasarPedido(de: EstadoPedido, a: EstadoPedido): boolean {
  return TRANSICIONES[de].includes(a);
}

/** Los estados a los que se puede pasar desde `de` (para el botón "Cambiar estado"). */
export function estadosSiguientes(de: EstadoPedido): readonly EstadoPedido[] {
  return TRANSICIONES[de];
}

// --- Cuotas -----------------------------------------------------------------------------------

/** Una cuota tal como sale de la base, ya con el importe en pesos y la fecha en "aaaa-mm-dd". */
export type CuotaLeida = {
  id: string;
  position: number;
  dueDate: string;
  amountArs: number;
  suggestedMethod: string | null;
};

/** Una imputación, con la marca de si su cobro está anulado (las de cobros anulados no cuentan). */
export type ImputacionLeida = { cuotaId: string; amountArs: number; anulada: boolean };

export type CuotaConEstado = CuotaLeida & {
  /** Lo imputado por cobros sin anular. */
  imputado: number;
  saldo: number;
  estado: EstadoCuota;
};

export function estadoDeCuota(
  cuota: { amountArs: number; imputado: number; dueDate: string },
  contexto: { hoy: string; pedidoCancelado: boolean },
): EstadoCuota {
  const saldo = aCentavos(cuota.amountArs) - aCentavos(cuota.imputado);
  if (saldo <= 0) return "PAGADA";
  if (contexto.pedidoCancelado) return "CANCELADA";
  if (cuota.dueDate < contexto.hoy) return "VENCIDA";
  if (aCentavos(cuota.imputado) > 0) return "PARCIAL";
  return "PENDIENTE";
}

/** Lo imputado (por cobros sin anular) a cada cuota, en centavos. */
export function imputadoPorCuota(imputaciones: readonly ImputacionLeida[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const i of imputaciones) {
    if (i.anulada) continue;
    mapa.set(i.cuotaId, (mapa.get(i.cuotaId) ?? 0) + aCentavos(i.amountArs));
  }
  return mapa;
}

export type ResumenPlan = {
  cuotas: CuotaConEstado[];
  total: number;
  /** Lo imputado por cobros sin anular. */
  cobrado: number;
  /** Total menos cobrado (nunca negativo). */
  saldo: number;
  /** Lo que falta cobrar: el saldo, salvo que el pedido esté cancelado (0). */
  aCobrar: number;
  /** Suma de los saldos de las cuotas vencidas. */
  vencido: number;
  cuotasVencidas: number;
  /** El vencimiento más próximo de una cuota con saldo (no cancelada), o null. */
  proximoVencimiento: string | null;
  /** La suma de las cuotas no da el total del pedido (p. ej. cambió el total). */
  descuadrado: boolean;
};

/**
 * Saldo por cuota y del pedido, y estado de cada cuota. `cuotas` en cualquier orden: salen por
 * posición. Las imputaciones de cuotas que no están en la lista se ignoran.
 */
export function resumenDePlan(
  cuotas: readonly CuotaLeida[],
  imputaciones: readonly ImputacionLeida[],
  contexto: { hoy: string; estadoPedido: EstadoPedido; total: number },
): ResumenPlan {
  const cancelado = contexto.estadoPedido === "CANCELADO";
  const porCuota = imputadoPorCuota(imputaciones);
  let cobrado = 0;
  let vencido = 0;
  let cuotasVencidas = 0;
  let suma = 0;
  let proximo: string | null = null;
  const conEstado = [...cuotas]
    .sort((a, b) => a.position - b.position)
    .map((c): CuotaConEstado => {
      const imputado = porCuota.get(c.id) ?? 0;
      const importe = aCentavos(c.amountArs);
      const saldo = Math.max(0, importe - imputado);
      cobrado += imputado;
      suma += importe;
      const estado = estadoDeCuota({ amountArs: c.amountArs, imputado: desdeCentavos(imputado), dueDate: c.dueDate }, { hoy: contexto.hoy, pedidoCancelado: cancelado });
      if (estado === "VENCIDA") {
        vencido += saldo;
        cuotasVencidas++;
      }
      if (saldo > 0 && !cancelado && (proximo === null || c.dueDate < proximo)) proximo = c.dueDate;
      return { ...c, imputado: desdeCentavos(imputado), saldo: desdeCentavos(saldo), estado };
    });
  const total = aCentavos(contexto.total);
  const saldo = Math.max(0, total - cobrado);
  return {
    cuotas: conEstado,
    total: desdeCentavos(total),
    cobrado: desdeCentavos(cobrado),
    saldo: desdeCentavos(saldo),
    aCobrar: cancelado ? 0 : desdeCentavos(saldo),
    vencido: desdeCentavos(vencido),
    cuotasVencidas,
    proximoVencimiento: proximo,
    descuadrado: suma !== total,
  };
}
