/**
 * Public marathon data source backed by published ClickatonEdition rows.
 * Prisma is the source of truth. No copy "TEST" en superficies públicas.
 */

import "server-only";

import { prisma } from "@repo/db";
import {
  ARGENTINA_2026_PUBLIC_META,
  argentina2026PublicFaq,
  argentina2026PublicSchedule,
} from "@/config/editions/argentina-2026-public-facts";
import {
  ARGENTINA_2026_SCHEDULE,
  CLICKATON_ARGENTINA_2026,
} from "@/config/editions/argentina-2026";
import type { PublicMarathonDataSource } from "@/data/public-marathons/types";
import type { PublicMarathon } from "@/types/marathon";

function isArgentina2026(slug: string): boolean {
  return slug === CLICKATON_ARGENTINA_2026.slug;
}

function mapEditionToPublicMarathon(row: {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  location: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string | null;
  isPublished: boolean;
  /** Kill switch comercial: false ⇒ CTA cerrado aunque las ventanas estén abiertas. */
  registrationEnabled: boolean;
  timezone: string | null;
  startAt: Date | null;
  endAt: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  defaultCapacity: number | null;
  coverImageUrl: string | null;
  coverImageVerticalUrl: string | null;
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
  const windowOpen = now >= openAt && now <= closeAt;
  const registrationOpen = Boolean(row.registrationEnabled) && windowOpen;
  const isFree = tickets.length > 0 && tickets.every((t) => t.priceAmount === 0);
  const hasPaid = tickets.some((t) => t.priceAmount > 0);
  const countryCode = venue?.country ?? row.country ?? "AR";
  const countryLabel = !countryCode || countryCode === "AR" ? "Argentina" : countryCode;
  const ar2026 = isArgentina2026(row.slug);
  const rawCity =
    venue?.city?.trim() ||
    row.city?.trim() ||
    (ar2026 ? ARGENTINA_2026_PUBLIC_META.city : "") ||
    row.location?.trim() ||
    "";
  // Evitar "Argentina, Argentina" cuando solo hay país/location genérico.
  const city =
    rawCity && rawCity.toLowerCase() !== countryLabel.toLowerCase()
      ? rawCity
      : ar2026
        ? ARGENTINA_2026_PUBLIC_META.city
        : "Sede a confirmar";
  const province =
    venue?.provinceOrState?.trim() ||
    row.provinceOrState?.trim() ||
    (ar2026 ? ARGENTINA_2026_PUBLIC_META.province : "");
  const priceFormatted = isFree
    ? "Gratis"
    : `Desde $${(minPrice / 100).toLocaleString("es-AR")} ${currency}`;
  const schedule = ar2026 ? argentina2026PublicSchedule() : [];
  const faq = ar2026
    ? argentina2026PublicFaq()
    : [
        {
          question: "¿Cuándo puedo inscribirme?",
          answer:
            "Cuando la edición habilite inscripciones. El precio vigente depende de la fase activa.",
        },
        {
          question: "¿Dónde veo mi QR?",
          answer: "En Mi cuenta, una vez confirmada la inscripción y el pago.",
        },
      ];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    editionName: row.name,
    shortDescription:
      row.shortDescription ??
      (ar2026
        ? "Maratón fotográfica en Rosario. 10 consignas, 19/09/2026. Inscripción con precio por fases e inclusión de remera según beneficio first-100."
        : "Maratón fotográfica Clickatón. Inscripciones configurables desde administración."),
    fullDescription:
      row.description ??
      row.shortDescription ??
      "Edición Clickatón. Revisá fechas, precio vigente e inclusión de kit antes de inscribirte.",
    status: registrationOpen ? "registration_open" : "announced",
    registrationStatus: registrationOpen ? "open" : "coming_soon",
    format: "individual",
    modality: "Presencial",
    featured: true,
    isDemo: false,
    city,
    provinceOrRegion: province,
    country: countryLabel,
    venueName: venue?.name,
    meetingPoint: venue?.meetingPoint ?? venue?.address ?? undefined,
    timezone: ar2026
      ? ARGENTINA_2026_PUBLIC_META.timezone
      : (row.timezone ?? "America/Argentina/Buenos_Aires"),
    startAt: ar2026
      ? new Date(ARGENTINA_2026_SCHEDULE.marathonStartIso).toISOString()
      : (row.startAt ?? new Date()).toISOString(),
    endAt: ar2026
      ? new Date(ARGENTINA_2026_SCHEDULE.marathonEndIso).toISOString()
      : (row.endAt ?? new Date()).toISOString(),
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
              formatted: priceFormatted,
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
    /** Flujo menores completo: LEGAL/UX BLOCKED — ficha indica +18 hasta decisión humana. */
    minimumAge: ar2026 ? 18 : 16,
    allowedDevices: ["smartphone", "camera"],
    coverImage: row.coverImageUrl ?? undefined,
    coverImageVertical: row.coverImageVerticalUrl ?? undefined,
    galleryPreview: row.coverImageUrl
      ? [row.coverImageUrl, ...(row.coverImageVerticalUrl ? [row.coverImageVerticalUrl] : [])]
      : row.coverImageVerticalUrl
        ? [row.coverImageVerticalUrl]
        : [],
    organizer: {
      name: "Clickatón",
      type: "producer",
      description: "Organización oficial Clickatón.",
      city,
      country: countryLabel,
    },
    localVenue: venue
      ? {
          name: venue.name,
          city: venue.city,
          provinceOrRegion: province,
          country: countryLabel,
        }
      : ar2026
        ? {
            name: "Rosario",
            city: ARGENTINA_2026_PUBLIC_META.city,
            provinceOrRegion: ARGENTINA_2026_PUBLIC_META.province,
            country: countryLabel,
          }
        : undefined,
    categories: [
      {
        id: "cat-general",
        name: "Participación general",
        description: ar2026
          ? "Inscripción individual. 10 consignas el día del evento."
          : "Categoría general de inscripción.",
        allowedDevices: ["smartphone", "camera"],
        ageRange: ar2026 ? "18+" : "16+",
      },
    ],
    schedule,
    prizes: [],
    jury: [],
    sponsors: [],
    faq,
    rules: {
      title: "Bases y condiciones",
      summary: "Revisá términos, privacidad y política de kit antes de inscribirte.",
      version: ar2026
        ? ARGENTINA_2026_PUBLIC_META.termsVersion
        : "pending-legal-review",
      content: ar2026
        ? `Al inscribirte aceptás explícitamente las Bases y Condiciones versión ${ARGENTINA_2026_PUBLIC_META.termsVersion} (publicadas y aprobadas para inscripción). Ver texto completo en /legal/terminos.`
        : "Las bases definitivas requieren aprobación legal antes de la apertura comercial.",
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
