/**
 * Conversión de unidades para el checkout de FotoRank.
 *
 * Punto de fricción conocido: las fases de precio del concurso guardan
 * **minor units enteras** (centavos: ARS 45.000 → 4_500_000), mientras que
 * Checkout Pro espera el total en **pesos**. Toda conversión pasa por acá y
 * sólo por acá: es donde se cometen los errores de factor 100.
 *
 * Nunca se hace aritmética de dinero con floats.
 */

/** Centavos por unidad de moneda. ARS usa 2 decimales. */
const MINOR_UNITS_PER_UNIT = 100;

export class CheckoutMoneyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CheckoutMoneyError";
    this.code = code;
  }
}

/**
 * Convierte minor units a pesos enteros.
 *
 * Falla si el importe tiene centavos: Checkout Pro recibiría un valor truncado
 * y el participante pagaría de menos sin que nadie lo note. Preferimos romper
 * ruidosamente antes que cobrar mal.
 */
export function minorToWholeUnits(amountMinor: number): number {
  if (!Number.isInteger(amountMinor)) {
    throw new CheckoutMoneyError(
      "AMOUNT_NOT_INTEGER",
      `El importe en minor units debe ser entero, recibido: ${amountMinor}`,
    );
  }
  if (amountMinor <= 0) {
    throw new CheckoutMoneyError(
      "AMOUNT_NOT_POSITIVE",
      `El importe debe ser mayor a cero, recibido: ${amountMinor}`,
    );
  }
  if (amountMinor % MINOR_UNITS_PER_UNIT !== 0) {
    throw new CheckoutMoneyError(
      "AMOUNT_HAS_CENTS",
      `El importe ${amountMinor} tiene centavos y Checkout Pro espera pesos enteros. ` +
        "Revisar la configuración de precios del concurso.",
    );
  }
  return amountMinor / MINOR_UNITS_PER_UNIT;
}

/** Inversa de `minorToWholeUnits`. Se usa al reconciliar contra el pago informado por MP. */
export function wholeUnitsToMinor(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new CheckoutMoneyError("AMOUNT_NOT_FINITE", `Importe inválido: ${amount}`);
  }
  // MP puede informar decimales (p. ej. 45000.00). Se redondea al centavo.
  const minor = Math.round(amount * MINOR_UNITS_PER_UNIT);
  if (minor <= 0) {
    throw new CheckoutMoneyError("AMOUNT_NOT_POSITIVE", `Importe no positivo: ${amount}`);
  }
  return minor;
}

/**
 * Verifica que el importe que MP informa como pagado coincide con el esperado.
 *
 * Tolerancia cero: cualquier diferencia se trata como discrepancia y NO se
 * confirma la inscripción automáticamente.
 */
export function paidAmountMatches(input: {
  expectedMinor: number;
  paidAmountFromProvider: number;
}): { ok: boolean; expectedMinor: number; paidMinor: number } {
  const paidMinor = wholeUnitsToMinor(input.paidAmountFromProvider);
  // Siempre se devuelven ambos montos: el llamador los necesita tanto para
  // confirmar como para registrar la discrepancia.
  return { ok: paidMinor === input.expectedMinor, expectedMinor: input.expectedMinor, paidMinor };
}

/** Formato para mostrar al participante. Entrada en minor units. */
export function formatArs(amountMinor: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / MINOR_UNITS_PER_UNIT);
}
