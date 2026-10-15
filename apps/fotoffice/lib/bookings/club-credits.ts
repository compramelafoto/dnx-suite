/**
 * Club con turnos incluidos — la parte pura.
 *
 * El caso es el VIP de una barbería: la persona paga la mensualidad y por cada pago tiene 4
 * cortes para usar en los 30 días siguientes. No se acumulan: lo que no usó se pierde cuando
 * vence o cuando paga de nuevo (ver `lib/membership/booking-credits.ts`).
 *
 * Lo gastado no se guarda en ningún saldo: es la suma de `creditsUsed` de sus reservas activas
 * de esa bolsa. Así una reserva cancelada o vencida devuelve el turno sola, sin ningún proceso
 * que pueda olvidarse de hacerlo. Mismo criterio que las horas bonificadas (`free-hours.ts`).
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export type ClubGrant = {
  id: string;
  credits: number;
  validFrom: Date;
  validUntil: Date;
};

export type ClubBalance = {
  grantId: string;
  credits: number;
  used: number;
  available: number;
  validUntil: Date;
};

/** La ventana de una bolsa: desde el pago hasta N días después. */
export function grantWindow(paidAt: Date, validityDays: number): { validFrom: Date; validUntil: Date } {
  const dias = Number.isFinite(validityDays) && validityDays > 0 ? Math.floor(validityDays) : 30;
  return { validFrom: paidAt, validUntil: new Date(paidAt.getTime() + dias * DIA_MS) };
}

/** Cuánto queda de una bolsa. Nunca negativo: si bajaron los turnos, la bolsa es cero. */
export function clubBalanceOf(grant: ClubGrant, usedCredits: number): ClubBalance {
  const used = Number.isFinite(usedCredits) && usedCredits > 0 ? Math.floor(usedCredits) : 0;
  return {
    grantId: grant.id,
    credits: grant.credits,
    used,
    available: Math.max(0, grant.credits - used),
    validUntil: grant.validUntil,
  };
}

/**
 * Cuántos turnos del club usa una reserva.
 *
 * En una agenda por bloque cada bloque es un turno: un corte de 30 minutos usa uno, una hora
 * usa dos. Sin bloque (por hora o por jornada) la reserva entera cuenta como un turno.
 */
export function creditsNeededFor(input: {
  pricingMode: string;
  blockMinutes: number | null;
  minutes: number;
}): number {
  if (input.pricingMode === "BLOCK" && input.blockMinutes && input.blockMinutes > 0) {
    return Math.max(1, Math.ceil(input.minutes / input.blockMinutes));
  }
  return 1;
}

/**
 * ¿Esta reserva sale de la bolsa?
 *
 * Hace falta saldo suficiente y que el turno caiga ANTES de que la bolsa venza: los cortes son
 * para usar dentro de los 30 días, no para reservar dentro de los 30 días un turno para dentro
 * de dos meses.
 */
export function canCoverWithCredits(input: {
  balance: ClubBalance | null;
  needed: number;
  startAt: Date;
}): boolean {
  if (!input.balance) return false;
  if (input.needed <= 0) return false;
  if (input.balance.available < input.needed) return false;
  return input.startAt.getTime() < input.balance.validUntil.getTime();
}

/** "cortes" si la categoría los nombró; "turnos" si no. El singular se deduce para los casos comunes. */
export function clubCreditWords(label: string | null | undefined): { singular: string; plural: string } {
  const plural = label?.trim().toLowerCase() || "turnos";
  const singular = plural.endsWith("ones")
    ? `${plural.slice(0, -4)}ón`
    : plural.endsWith("s")
      ? plural.slice(0, -1)
      : plural;
  return { singular, plural };
}
