/**
 * Public marathon data source backed by published ClickatonEdition rows (11B).
 * Prisma is the source of truth for the pilot TEST edition.
 */

import "server-only";

import { prisma } from "@repo/db";
import type { PublicMarathonDataSource } from "@/data/public-marathons/types";
import type { PublicMarathon } from "@/types/marathon";

function mapEditionToPublicMarathon(row: {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  isPublished: boolean;
  timezone: string | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  defaultCapacity: number | null;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  venues: Array<{
    name: string;
    city: string;
    provinceOrState: string | null;
    country: string;
    address: string | null;
    meetingPoint: string | null;
    isActive: boolean;
  }>;
  ticketTypes: Array<{
    priceAmount: number;
    currency: string;
    isActive: boolean;
    capacity: number | null;
  }>;
}): PublicMarathon {
  const venue = row.venues.find((v) => v.isActive) ?? row.venues[0];
  const tickets = row.ticketTypes.filter((t) => t.isActive);
  const minPrice = tickets.reduce(
    (min, t) => Math.min(min, t.priceAmount),
    tickets[0]?.priceAmount ?? 0,
  );
  const currency = tickets[0]?.currency ?? "ARS";
  const now = Date.now();
  const openAt = row.registrationOpenAt?.getTime() ?? 0;
  const closeAt = row.registrationCloseAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const registrationOpen = now >= openAt && now <= closeAt;
  const isFree = tickets.length > 0 && tickets.every((t) => t.priceAmount === 0);
  const hasPaid = tickets.some((t) => t.priceAmount > 0);
  const city = venue?.city ?? "Ciudad TEST";
  const province = venue?.provinceOrState ?? "Provincia TEST";
  const countryLabel =
    !venue?.country || venue.country === "AR" ? "Argentina" : venue.country;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    editionName: row.name,
    shortDescription:
      row.shortDescription ??
      "Edición piloto TEST de Clickatón para validar el funnel de inscripción.",
    fullDescription:
      row.description ??
      row.shortDescription ??
      "Edición de prueba. No es un evento comercial. Permite recorrer inscripción, pago sandbox, QR y Mi cuenta.",
    status: registrationOpen ? "registration_open" : "announced",
    registrationStatus: registrationOpen ? "open" : "coming_soon",
    format: "individual",
    modality: "Presencial (TEST)",
    featured: true,
    isDemo: false,
    city,
    provinceOrRegion: province,
    country: countryLabel,
    venueName: venue?.name ?? "Sede TEST",
    meetingPoint: venue?.meetingPoint ?? venue?.address ?? "Punto de encuentro TEST",
    timezone: row.timezone ?? "America/Argentina/Buenos_Aires",
    startAt: (row.startAt ?? new Date()).toISOString(),
    endAt: (row.endAt ?? new Date()).toISOString(),
    registrationOpenAt: row.registrationOpenAt?.toISOString(),
    registrationCloseAt: row.registrationCloseAt?.toISOString(),
    registration: {
      mode: isFree ? "free" : hasPaid ? "paid" : "free",
      status: registrationOpen ? "open" : "not_open",
      canRegister: registrationOpen && tickets.length > 0,
      displayPrice:
        tickets.length === 0
          ? null
          : {
              amountMinor: minPrice,
              currency,
              formatted: isFree
                ? "Gratis (TEST)"
                : `Desde $${(minPrice / 100).toLocaleString("es-AR")} ${currency} (TEST)`,
            },
      hasOptionalMerchandise: false,
      registrationUrl: null,
      checkoutUrl: null,
      opensAt: row.registrationOpenAt?.toISOString() ?? null,
      closesAt: row.registrationCloseAt?.toISOString() ?? null,
      capacity: row.defaultCapacity ?? null,
      remainingSpots: null,
    },
    participantLimit: row.defaultCapacity ?? undefined,
    minimumAge: 16,
    allowedDevices: ["smartphone", "camera"],
    coverImage: row.coverImageUrl ?? undefined,
    galleryPreview: row.coverImageUrl ? [row.coverImageUrl] : [],
    organizer: {
      name: "Clickatón TEST",
      type: "producer",
      description: "Organización de prueba — no comercial.",
      city,
      country: countryLabel,
    },
    localVenue: venue
      ? {
          name: venue.name,
          city: venue.city,
          provinceOrRegion: province,
          country: countryLabel,
          coordinatorName: "Coordinación TEST",
          description: "Sede piloto para el funnel 11B.",
        }
      : undefined,
    categories: [
      {
        id: "cat-test",
        name: "Participación TEST",
        description: "Categoría de prueba del funnel de inscripción.",
        allowedDevices: ["smartphone", "camera"],
        ageRange: "16+",
      },
    ],
    schedule: [],
    prizes: [],
    jury: [],
    sponsors: [],
    faq: [
      {
        question: "¿Es un cobro real?",
        answer: "No. Esta edición piloto opera en entorno de prueba / sandbox.",
      },
      {
        question: "¿Dónde veo mi QR?",
        answer: "En Mi cuenta, una vez confirmada la inscripción.",
      },
    ],
    rules: {
      title: "Bases TEST",
      summary:
        "Bases de prueba del funnel. Revisá términos y privacidad antes de inscribirte.",
      version: "test-11b",
      content:
        "Entorno TEST: no hay cobro real. El QR y la credencial se entregan tras la confirmación.",
    },
    resultsStatus: "not_available",
    galleryStatus: "not_available",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadPublishedEditions() {
  return prisma.clickatonEdition.findMany({
    where: {
      isPublished: true,
      status: { not: "CANCELLED" },
    },
    include: {
      venues: true,
      ticketTypes: { where: { isActive: true } },
    },
    orderBy: { startAt: "asc" },
  });
}

export function createPrismaPublicMarathonDataSource(): PublicMarathonDataSource {
  return {
    async listListed() {
      const rows = await loadPublishedEditions();
      return rows.filter((r) => r.isPublished).map((r) => mapEditionToPublicMarathon(r));
    },
    async getBySlug(slug: string) {
      const row = await prisma.clickatonEdition.findUnique({
        where: { slug: slug.trim() },
        include: {
          venues: true,
          ticketTypes: { where: { isActive: true } },
        },
      });
      if (!row || !row.isPublished) return null;
      return mapEditionToPublicMarathon(row);
    },
    async listRoutableSlugs() {
      const rows = await prisma.clickatonEdition.findMany({
        where: { isPublished: true },
        select: { slug: true },
      });
      return rows.map((r) => r.slug);
    },
  };
}
