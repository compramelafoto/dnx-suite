/**
 * Variantes de inscripción pública para self-checks / design-system.
 * No cargar todas en el home: el catálogo demo sigue siendo narrativo.
 */
import type { PublicRegistrationSummary } from "@/types/public/registration";

export const registrationFixtureFreeOpen: PublicRegistrationSummary = {
  mode: "free",
  status: "open",
  canRegister: true,
  displayPrice: null,
  hasOptionalMerchandise: false,
  registrationUrl: "http://localhost:3000/concursos/demo?source=clickaton&returnTo=%2Fmaratones%2Fdemo",
  checkoutUrl: null,
  opensAt: "2026-01-01T00:00:00.000Z",
  closesAt: "2026-12-31T00:00:00.000Z",
  capacity: null,
  remainingSpots: null,
};

export const registrationFixturePaidOpen: PublicRegistrationSummary = {
  mode: "paid",
  status: "open",
  canRegister: true,
  displayPrice: {
    amountMinor: 2_000_000,
    currency: "ARS",
    formatted: "$ 20.000,00",
  },
  hasOptionalMerchandise: false,
  registrationUrl: "http://localhost:3000/concursos/demo-paid?source=clickaton",
  checkoutUrl: null,
  opensAt: "2026-01-01T00:00:00.000Z",
  closesAt: "2026-12-31T00:00:00.000Z",
  capacity: null,
  remainingSpots: null,
};

export const registrationFixturePaidWithMerch: PublicRegistrationSummary = {
  ...registrationFixturePaidOpen,
  hasOptionalMerchandise: true,
};

export const registrationFixtureComingSoon: PublicRegistrationSummary = {
  mode: "free",
  status: "not_open",
  canRegister: false,
  displayPrice: null,
  hasOptionalMerchandise: false,
  registrationUrl: null,
  checkoutUrl: null,
  opensAt: "2027-01-01T00:00:00.000Z",
  closesAt: "2027-12-31T00:00:00.000Z",
  capacity: null,
  remainingSpots: null,
};

export const registrationFixtureClosed: PublicRegistrationSummary = {
  mode: "free",
  status: "closed",
  canRegister: false,
  displayPrice: null,
  hasOptionalMerchandise: false,
  registrationUrl: null,
  checkoutUrl: null,
  opensAt: "2025-01-01T00:00:00.000Z",
  closesAt: "2025-06-01T00:00:00.000Z",
  capacity: null,
  remainingSpots: null,
};

export const registrationFixtureFull: PublicRegistrationSummary = {
  mode: "paid",
  status: "full",
  canRegister: false,
  displayPrice: {
    amountMinor: 500_000,
    currency: "ARS",
    formatted: "$ 5.000,00",
  },
  hasOptionalMerchandise: false,
  registrationUrl: null,
  checkoutUrl: null,
  opensAt: "2026-01-01T00:00:00.000Z",
  closesAt: "2026-12-31T00:00:00.000Z",
  capacity: 50,
  remainingSpots: 0,
};

export const registrationFixtureFinished: PublicRegistrationSummary = {
  mode: "free",
  status: "finished",
  canRegister: false,
  displayPrice: null,
  hasOptionalMerchandise: false,
  registrationUrl: null,
  checkoutUrl: null,
  opensAt: null,
  closesAt: null,
  capacity: null,
  remainingSpots: null,
};

export const registrationFixtureCancelled: PublicRegistrationSummary = {
  mode: "free",
  status: "cancelled",
  canRegister: false,
  displayPrice: null,
  hasOptionalMerchandise: false,
  registrationUrl: null,
  checkoutUrl: null,
  opensAt: null,
  closesAt: null,
  capacity: null,
  remainingSpots: null,
};

export const registrationFixtureMissingUrl: PublicRegistrationSummary = {
  mode: "free",
  status: "open",
  canRegister: true,
  displayPrice: null,
  hasOptionalMerchandise: false,
  registrationUrl: null,
  checkoutUrl: null,
  opensAt: null,
  closesAt: null,
  capacity: null,
  remainingSpots: null,
};

/** Payload inconsistente: paid sin precio → UI no debe mostrar CTA operativo. */
export const registrationFixtureInvalidPaid: PublicRegistrationSummary = {
  mode: "paid",
  status: "open",
  canRegister: false,
  displayPrice: null,
  hasOptionalMerchandise: false,
  registrationUrl: null,
  checkoutUrl: null,
  opensAt: null,
  closesAt: null,
  capacity: null,
  remainingSpots: null,
};

export const registrationFixturesForShowroom = [
  { id: "free-open", label: "Gratuita abierta", value: registrationFixtureFreeOpen },
  { id: "paid-open", label: "Paga abierta", value: registrationFixturePaidOpen },
  { id: "paid-merch", label: "Paga + merch", value: registrationFixturePaidWithMerch },
  { id: "coming-soon", label: "Próximamente", value: registrationFixtureComingSoon },
  { id: "closed", label: "Cerrada", value: registrationFixtureClosed },
  { id: "full", label: "Cupo completo", value: registrationFixtureFull },
  { id: "finished", label: "Finalizada", value: registrationFixtureFinished },
  { id: "cancelled", label: "Cancelada", value: registrationFixtureCancelled },
  { id: "missing-url", label: "URL ausente", value: registrationFixtureMissingUrl },
  { id: "invalid-paid", label: "Payload inválido", value: registrationFixtureInvalidPaid },
] as const;
