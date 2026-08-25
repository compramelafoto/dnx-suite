import { Prisma } from "@repo/db";

/**
 * Escala de cuota.
 *
 * Es ortogonal a la categoría: un estudiante y un profesional pueden ser ambos socios
 * activos con los mismos derechos y diferir solo en cuánto pagan. Por eso la escala vive
 * en el socio y no en la categoría — un estudiante que se recibe cambia de escala sin
 * tocar nada de padrón ni de voto.
 */
export type FeeScale = "PLENA" | "REDUCIDA" | "EXENTA";

export function scaleMultiplier(scale: FeeScale): Prisma.Decimal {
  switch (scale) {
    case "PLENA":
      return new Prisma.Decimal(1);
    case "REDUCIDA":
      return new Prisma.Decimal("0.5");
    case "EXENTA":
      return new Prisma.Decimal(0);
  }
}

/**
 * Cuota mensual de un socio.
 *
 * Si tiene monto propio (colaborador) se usa ese, pero **nunca por debajo del piso**: el
 * aporte es libre hacia arriba, no hacia abajo.
 */
export function monthlyAmountFor(input: {
  referenceAmount: Prisma.Decimal;
  scale: FeeScale;
  ownAmount?: Prisma.Decimal | null;
  /** Múltiplo del valor de referencia que funciona como piso del aporte libre. */
  floorMultiple: number;
}): Prisma.Decimal {
  if (input.ownAmount) {
    const floor = input.referenceAmount.mul(input.floorMultiple);
    const elegido = input.ownAmount.lt(floor) ? floor : input.ownAmount;
    return elegido.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
  return input.referenceAmount
    .mul(scaleMultiplier(input.scale))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Total de las cuotas de ingreso.
 *
 * Se multiplica el monto **ya redondeado** por la cantidad, para que el total cobrado sea
 * exactamente la suma de los cargos que se generan. Si se redondeara al final, el socio
 * pagaría un centavo distinto del que suman sus cuotas, y esa diferencia queda para
 * siempre como saldo fantasma.
 */
export function initialChargeTotal(monthly: Prisma.Decimal, count: number): Prisma.Decimal {
  if (count <= 0) return new Prisma.Decimal(0);
  return monthly.mul(count).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
