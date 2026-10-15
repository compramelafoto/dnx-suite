/**
 * Armado mínimo para probar el funnel contra el repositorio en memoria.
 * La edición se siembra con la ventana de inscripción abierta alrededor del
 * reloj fijo, para que createRegistration no rebote por ventana cerrada.
 */
import { fixedClock } from "@/lib/timeline/clock";

import {
  createInMemoryPublicRegistrationRepository,
  createInMemoryPublicStore,
  newIdempotencyKey,
  seedPublicEdition,
  seedPublicTicket,
  type InMemoryPublicStore,
} from "../infrastructure/in-memory-public-registration-repository";
import { createPublicRegistrationService } from "./public-registration-service";

const ABRE = new Date("2026-09-01T12:00:00.000Z");
const CIERRA = new Date("2026-12-01T23:59:00.000Z");
const AHORA = new Date("2026-10-01T12:00:00.000Z");

export type Escenario = {
  store: InMemoryPublicStore;
  service: ReturnType<typeof createPublicRegistrationService>;
  editionSlug: string;
  ticketTypeId: string;
};

export function crearEscenario(): Escenario {
  const store = createInMemoryPublicStore();
  seedPublicEdition(store, {
    id: "ed_consent",
    slug: "consentimientos-ubicacion",
    name: "Edición de prueba de consentimientos",
    shortDescription: "Prueba",
    status: "REGISTRATION_OPEN",
    isPublished: true,
    registrationEnabled: true,
    registrationOpenAt: ABRE,
    registrationCloseAt: CIERRA,
    startAt: new Date("2026-12-12T15:00:00.000Z"),
    endAt: new Date("2026-12-12T23:00:00.000Z"),
    timezone: "America/Argentina/Buenos_Aires",
    visibleCodePrefix: "CNS26",
  });
  seedPublicTicket(store, {
    id: "tt_general",
    editionId: "ed_consent",
    venueId: null,
    name: "General",
    description: null,
    code: "GEN",
    priceAmount: 1_500_000,
    currency: "ARS",
    capacity: 100,
    holdMinutes: 20,
    isActive: true,
    salesStartAt: ABRE,
    salesEndAt: CIERRA,
    products: [],
  });

  const clock = fixedClock(AHORA);
  return {
    store,
    service: createPublicRegistrationService({
      repo: createInMemoryPublicRegistrationRepository(store, { clock }),
      clock,
    }),
    editionSlug: "consentimientos-ubicacion",
    ticketTypeId: "tt_general",
  };
}

export async function inscribir(
  esc: Escenario,
  consent: {
    locationConsent?: boolean;
    locationPublicConsent?: boolean;
    interviewConsent?: boolean;
    locationDeclaredAdult?: boolean;
  },
  /** Sólo para probar el camino de un menor: el formulario público todavía
   * no recolecta datos del adulto responsable. */
  participantOverrides?: { birthDate?: string },
) {
  const result = await esc.service.createRegistration({
    editionSlug: esc.editionSlug,
    venueId: null,
    ticketTypeId: esc.ticketTypeId,
    variantChoices: [],
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: `ana+${newIdempotencyKey()}@example.com`,
      city: "Santa Fe",
      province: "Santa Fe",
      country: "AR",
      birthDate: participantOverrides?.birthDate,
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "anaperez",
    profilePhotoAssetId: "asset-test",
    idempotencyKey: newIdempotencyKey(),
    ...consent,
  });
  const reg = esc.store.domain.registrations.get(result.registrationId);
  if (!reg) throw new Error("no se creó la inscripción");
  return reg;
}
