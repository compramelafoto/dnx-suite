/**
 * Qué cuotas se pagan y por cuánto.
 *
 * Todo en centavos enteros. Los importes viven en la base como `Decimal`; la conversión pasa
 * en el borde, y de acá para adentro no hay coma flotante.
 */

export type OpenCharge = {
  id: string;
  concept: string;
  /** `YYYY-MM`. El mes que la cuota cubre. */
  period: string;
  dueDate: Date;
  /** Saldo pendiente en centavos. */
  balanceMinor: number;
};

export type ChargeSelection = {
  chargeIds: string[];
  totalMinor: number;
  /** El período más viejo incluido. Sirve para el texto del cobro. */
  oldestPeriod: string;
  /** Cuántas quedan sin pagar después de esta selección. */
  remaining: number;
};

export type SelectionResult =
  | { ok: true; selection: ChargeSelection }
  | { ok: false; message: string };

/**
 * De la más vieja a la más nueva.
 *
 * Se ordena por vencimiento y, a igual vencimiento, por período: dos cargos del mismo día
 * tienen que quedar en un orden estable o dos ejecuciones darían selecciones distintas.
 */
export function sortOldestFirst(charges: OpenCharge[]): OpenCharge[] {
  return [...charges].sort((a, b) => {
    const porFecha = a.dueDate.getTime() - b.dueDate.getTime();
    if (porFecha !== 0) return porFecha;
    return a.period.localeCompare(b.period);
  });
}

/**
 * Elige los cargos a pagar empezando por el más viejo.
 *
 * **No se puede saltear.** Pagar la cuota de agosto dejando junio impaga ensucia el cálculo
 * de mora: el socio figuraría al día en agosto y con tres meses de atraso a la vez. Por eso
 * la única decisión que se le ofrece es cuántas cuotas pagar, no cuáles.
 */
export function selectChargesToPay(
  charges: OpenCharge[],
  opciones: { howMany?: number | "ALL" } = {},
): SelectionResult {
  const conSaldo = charges.filter((c) => c.balanceMinor > 0);
  if (conSaldo.length === 0) {
    return { ok: false, message: "No hay cuotas pendientes de pago." };
  }

  const ordenados = sortOldestFirst(conSaldo);
  const pedidas = opciones.howMany ?? "ALL";

  if (pedidas !== "ALL") {
    if (!Number.isInteger(pedidas) || pedidas < 1) {
      return { ok: false, message: "La cantidad de cuotas a pagar tiene que ser un número mayor que cero." };
    }
  }

  const cuantas = pedidas === "ALL" ? ordenados.length : Math.min(pedidas, ordenados.length);
  const elegidos = ordenados.slice(0, cuantas);

  const totalMinor = elegidos.reduce((suma, c) => suma + c.balanceMinor, 0);
  const primero = elegidos[0];
  if (!primero) {
    return { ok: false, message: "No hay cuotas pendientes de pago." };
  }

  return {
    ok: true,
    selection: {
      chargeIds: elegidos.map((c) => c.id),
      totalMinor,
      oldestPeriod: primero.period,
      remaining: ordenados.length - elegidos.length,
    },
  };
}
