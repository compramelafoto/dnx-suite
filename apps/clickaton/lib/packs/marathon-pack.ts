/**
 * Pack de 4 maratones — oferta comercial global (todas las ediciones).
 * Precio fijo en minor units (centavos): $100.000 ARS = 10_000_000.
 */

export const MARATHON_PACK_TICKET_CODE = "PACK_4";

export const MARATHON_PACK = {
  code: MARATHON_PACK_TICKET_CODE,
  name: "Pack de 4 maratones",
  description:
    "Inscribite a esta maratón y obtené 3 usos más para futuras Clickatón. Validez 2 años desde la compra. Los créditos se descuentan al inscribirte en cada edición.",
  /** Minor units (centavos). */
  priceAmountMinor: 10_000_000,
  currency: "ARS",
  credits: 4,
  validityYears: 2,
  holdMinutes: 20,
} as const;

export function isMarathonPackTicketCode(code: string | null | undefined): boolean {
  return (code ?? "").trim().toUpperCase() === MARATHON_PACK_TICKET_CODE;
}

export function marathonPackExpiresAt(from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setFullYear(d.getFullYear() + MARATHON_PACK.validityYears);
  return d;
}
