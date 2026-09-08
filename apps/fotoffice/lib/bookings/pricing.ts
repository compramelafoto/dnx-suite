import { formatMinorArs } from "@/lib/membership/money";

/**
 * Cuánto sale una reserva. Módulo PURO: sin base y sin red.
 *
 * Todo en centavos y con enteros, por la misma razón por la que el resto del dinero de
 * FotoOffice no se calcula en coma flotante.
 *
 * La bonificación se aplica **al principio** de la reserva: cuatro horas con dos
 * bonificadas disponibles son dos gratis y dos al precio de socio. Aplicarla al final daría
 * el mismo total pero haría más difícil explicarle a alguien qué parte de su reserva
 * consumió el beneficio.
 */

export type CustomerType = "MEMBER" | "NON_MEMBER";

export type Quote = {
  freeMinutesUsed: number;
  billedMinutes: number;
  /** El precio por hora que se aplicó. Se congela en la reserva. */
  hourlyPriceMinor: number;
  totalMinor: number;
};

export function quoteBooking(input: {
  minutes: number;
  customerType: CustomerType;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  /** Minutos bonificados que le quedan al socio este mes. Cero para un no socio. */
  freeMinutesAvailable: number;
}): Quote {
  const hourlyPriceMinor =
    input.customerType === "MEMBER"
      ? input.memberHourlyPriceMinor
      : input.nonMemberHourlyPriceMinor;

  const minutos =
    Number.isFinite(input.minutes) && input.minutes > 0 ? Math.floor(input.minutes) : 0;
  if (minutos === 0) {
    return { freeMinutesUsed: 0, billedMinutes: 0, hourlyPriceMinor, totalMinor: 0 };
  }

  // Un no socio no tiene bolsa, sin importar lo que le pasen. Que la regla viva acá y no
  // en quien llama evita que una pantalla nueva se olvide de aplicarla.
  const disponibles =
    input.customerType === "MEMBER" && Number.isFinite(input.freeMinutesAvailable)
      ? Math.max(0, Math.floor(input.freeMinutesAvailable))
      : 0;

  const freeMinutesUsed = Math.min(minutos, disponibles);
  const billedMinutes = minutos - freeMinutesUsed;

  // Se multiplica primero y se divide después: dividir el precio por 60 antes de
  // multiplicar arrastraría el redondeo a cada minuto.
  const totalMinor = Math.round((hourlyPriceMinor * billedMinutes) / 60);

  return { freeMinutesUsed, billedMinutes, hourlyPriceMinor, totalMinor };
}

function horas(minutos: number): string {
  const h = minutos / 60;
  const texto = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
  return `${texto} h`;
}

/** Las líneas del desglose, en el orden en que se leen. */
export function describeQuote(quote: Quote, minutes: number): string[] {
  const lineas: string[] = [];

  if (quote.freeMinutesUsed > 0) {
    lineas.push(`${horas(quote.freeMinutesUsed)} bonificadas por ser socio — sin cargo`);
  }

  if (quote.billedMinutes > 0) {
    lineas.push(
      `${horas(quote.billedMinutes)} × ${formatMinorArs(quote.hourlyPriceMinor)} por hora — ${formatMinorArs(quote.totalMinor)}`,
    );
  }

  lineas.push(
    quote.totalMinor === 0
      ? "Sin cargo"
      : `Total: ${formatMinorArs(quote.totalMinor)} por ${horas(minutes)}`,
  );

  return lineas;
}
