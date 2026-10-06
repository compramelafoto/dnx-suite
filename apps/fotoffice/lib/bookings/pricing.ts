import { formatMinorArs } from "@/lib/membership/money";

/**
 * Cuánto sale una reserva. Módulo PURO: sin base y sin red.
 *
 * Todo en centavos y con enteros, por la misma razón por la que el resto del dinero de
 * FotoOffice no se calcula en coma flotante.
 *
 * ── Dos formas de cobrar ──
 *
 * `HOURLY` es como nació el módulo: precio por hora, prorrateado por minuto.
 *
 * `BLOCK` existe porque hay espacios que no se venden por hora. El estudio va en paquetes de dos
 * horas a un precio fijo; el salón tiene precio plano por jornada, dure lo que dure. Ninguno de
 * los dos se puede escribir como tarifa horaria —no hay número por hora que dé el mismo total
 * para tres, cuatro y cinco horas— y fingir que sí obligaba a mostrarle a la gente un precio por
 * hora que no es el que paga.
 *
 * ── La bonificación ──
 *
 * Se aplica **al principio** de la reserva: cuatro horas con dos bonificadas disponibles son dos
 * gratis y dos al precio de socio. Aplicarla al final daría el mismo total pero haría más difícil
 * explicarle a alguien qué parte de su reserva consumió el beneficio.
 *
 * En modo bloque la bonificación se cuenta en bloques enteros: media hora bonificada no alcanza
 * para no pagar un paquete de dos horas, y cobrar medio paquete no es algo que exista.
 */

export type CustomerType = "MEMBER" | "NON_MEMBER";
export type PricingMode = "HOURLY" | "BLOCK";

export function esPricingMode(v: unknown): v is PricingMode {
  return v === "HOURLY" || v === "BLOCK";
}

export type Quote = {
  freeMinutesUsed: number;
  billedMinutes: number;
  mode: PricingMode;
  /** El precio por hora que se aplicó. Cero en modo bloque: ahí no hay precio por hora. */
  hourlyPriceMinor: number;
  /** En modo bloque: cuánto sale cada bloque y cuántos se cobran. */
  blockPriceMinor: number;
  blocksBilled: number;
  /** Bloques que cubrió la bonificación. Sirve para explicar el desglose. */
  blocksFree: number;
  totalMinor: number;
};

export type QuoteInput = {
  minutes: number;
  customerType: CustomerType;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  /** Minutos bonificados que le quedan al socio este mes. Cero para un no socio. */
  freeMinutesAvailable: number;
  /** Por omisión `HOURLY`, para que un caller viejo siga cobrando como antes. */
  mode?: PricingMode;
  /** Tamaño del bloque. `null`/ausente con `mode: "BLOCK"` = un solo bloque por reserva. */
  blockMinutes?: number | null;
  memberBlockPriceMinor?: number;
  nonMemberBlockPriceMinor?: number;
};

const vacio = (mode: PricingMode, hourlyPriceMinor: number, blockPriceMinor: number): Quote => ({
  freeMinutesUsed: 0,
  billedMinutes: 0,
  mode,
  hourlyPriceMinor,
  blockPriceMinor,
  blocksBilled: 0,
  blocksFree: 0,
  totalMinor: 0,
});

export function quoteBooking(input: QuoteInput): Quote {
  const mode: PricingMode = input.mode === "BLOCK" ? "BLOCK" : "HOURLY";
  const esSocio = input.customerType === "MEMBER";

  const hourlyPriceMinor = esSocio ? input.memberHourlyPriceMinor : input.nonMemberHourlyPriceMinor;
  const blockPriceMinor = esSocio
    ? (input.memberBlockPriceMinor ?? 0)
    : (input.nonMemberBlockPriceMinor ?? 0);

  const minutos =
    Number.isFinite(input.minutes) && input.minutes > 0 ? Math.floor(input.minutes) : 0;
  if (minutos === 0) return vacio(mode, hourlyPriceMinor, blockPriceMinor);

  // Un no socio no tiene bolsa, sin importar lo que le pasen. Que la regla viva acá y no en quien
  // llama evita que una pantalla nueva se olvide de aplicarla.
  const disponibles =
    esSocio && Number.isFinite(input.freeMinutesAvailable)
      ? Math.max(0, Math.floor(input.freeMinutesAvailable))
      : 0;

  if (mode === "HOURLY") {
    const freeMinutesUsed = Math.min(minutos, disponibles);
    const billedMinutes = minutos - freeMinutesUsed;
    // Se multiplica primero y se divide después: dividir el precio por 60 antes de multiplicar
    // arrastraría el redondeo a cada minuto.
    const totalMinor = Math.round((hourlyPriceMinor * billedMinutes) / 60);
    return {
      freeMinutesUsed,
      billedMinutes,
      mode,
      hourlyPriceMinor,
      blockPriceMinor: 0,
      blocksBilled: 0,
      blocksFree: 0,
      totalMinor,
    };
  }

  // Sin tamaño de bloque, la reserva entera es un bloque: la "jornada". El piso de duración lo
  // pone `minBookingMinutes` del espacio, no este cálculo.
  const tamano =
    typeof input.blockMinutes === "number" && input.blockMinutes > 0
      ? Math.floor(input.blockMinutes)
      : null;

  const bloquesTotales = tamano === null ? 1 : Math.ceil(minutos / tamano);
  // En bloques enteros: media hora bonificada no paga un paquete de dos horas.
  const bloquesGratis =
    tamano === null
      ? disponibles >= minutos
        ? 1
        : 0
      : Math.min(bloquesTotales, Math.floor(disponibles / tamano));

  const blocksBilled = bloquesTotales - bloquesGratis;
  const freeMinutesUsed =
    tamano === null ? (bloquesGratis === 1 ? minutos : 0) : Math.min(minutos, bloquesGratis * tamano);

  return {
    freeMinutesUsed,
    billedMinutes: minutos - freeMinutesUsed,
    mode,
    hourlyPriceMinor: 0,
    blockPriceMinor,
    blocksBilled,
    blocksFree: bloquesGratis,
    totalMinor: blockPriceMinor * blocksBilled,
  };
}

function horas(minutos: number): string {
  const h = minutos / 60;
  const texto = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
  return `${texto} h`;
}

/** Cómo se nombra un bloque: "2 horas", o "la jornada" cuando no tiene tamaño. */
export function nombreDelBloque(blockMinutes: number | null | undefined): string {
  if (typeof blockMinutes !== "number" || blockMinutes <= 0) return "la jornada";
  return horas(blockMinutes);
}

/**
 * Cómo se anuncia el precio de un espacio en una sola línea.
 *
 * Es lo que va arriba de la pantalla de reserva. En modo bloque NUNCA dice "por hora": ése fue
 * todo el punto de agregar el modo.
 */
export function etiquetaDePrecio(input: {
  mode: PricingMode;
  hourlyPriceMinor: number;
  blockPriceMinor: number;
  blockMinutes: number | null | undefined;
}): string {
  if (input.mode === "BLOCK") {
    const bloque = nombreDelBloque(input.blockMinutes);
    return input.blockMinutes
      ? `${formatMinorArs(input.blockPriceMinor)} cada ${bloque}`
      : `${formatMinorArs(input.blockPriceMinor)} por jornada`;
  }
  return `${formatMinorArs(input.hourlyPriceMinor)} por hora`;
}

/** Las líneas del desglose, en el orden en que se leen. */
export function describeQuote(
  quote: Quote,
  minutes: number,
  blockMinutes?: number | null,
): string[] {
  const lineas: string[] = [];

  if (quote.mode === "BLOCK") {
    const bloque = nombreDelBloque(blockMinutes);
    const nombrePlural = blockMinutes ? `de ${bloque}` : "de jornada";

    if (quote.blocksFree > 0) {
      lineas.push(
        quote.blocksFree === 1
          ? `1 bloque ${nombrePlural} bonificado por ser socio — sin cargo`
          : `${quote.blocksFree} bloques ${nombrePlural} bonificados por ser socio — sin cargo`,
      );
    }
    if (quote.blocksBilled > 0) {
      lineas.push(
        blockMinutes
          ? `${quote.blocksBilled} × ${bloque} a ${formatMinorArs(quote.blockPriceMinor)} — ${formatMinorArs(quote.totalMinor)}`
          : `Jornada — ${formatMinorArs(quote.totalMinor)}`,
      );
    }
    lineas.push(
      quote.totalMinor === 0
        ? "Sin cargo"
        : `Total: ${formatMinorArs(quote.totalMinor)} por ${horas(minutes)}`,
    );
    return lineas;
  }

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

/** Cómo cobra un espacio: lo que el cálculo necesita saber de él, y nada más. */
export type SpacePricing = {
  pricingMode: PricingMode;
  blockMinutes: number | null;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  memberBlockPriceMinor: number;
  nonMemberBlockPriceMinor: number;
};

/**
 * El precio de una reserva en un espacio, según su modo.
 *
 * Es la única puerta de entrada para quien cotiza una reserva real —el portal, la página
 * pública, la carga manual y `createBooking`—: si cada uno armara el `QuoteInput` a mano,
 * bastaría con que uno se olvide del modo para cobrar por hora un espacio que va por bloque.
 */
export function quoteForSpace(
  space: SpacePricing,
  input: { minutes: number; customerType: CustomerType; freeMinutesAvailable: number },
): Quote {
  return quoteBooking({
    minutes: input.minutes,
    customerType: input.customerType,
    freeMinutesAvailable: input.freeMinutesAvailable,
    mode: space.pricingMode,
    blockMinutes: space.blockMinutes,
    memberHourlyPriceMinor: space.memberHourlyPriceMinor,
    nonMemberHourlyPriceMinor: space.nonMemberHourlyPriceMinor,
    memberBlockPriceMinor: space.memberBlockPriceMinor,
    nonMemberBlockPriceMinor: space.nonMemberBlockPriceMinor,
  });
}

/** El precio de un espacio en una línea, para el tipo de cliente que mira. */
export function spacePriceLabel(space: SpacePricing, customerType: CustomerType): string {
  const socio = customerType === "MEMBER";
  return etiquetaDePrecio({
    mode: space.pricingMode,
    hourlyPriceMinor: socio ? space.memberHourlyPriceMinor : space.nonMemberHourlyPriceMinor,
    blockPriceMinor: socio ? space.memberBlockPriceMinor : space.nonMemberBlockPriceMinor,
    blockMinutes: space.blockMinutes,
  });
}
