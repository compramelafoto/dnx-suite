/**
 * Seed / upsert edición piloto TEST para funnel 11B.
 * Staging only. Idempotent by slug `piloto-test-11b`.
 *
 * Usage:
 *   CLICKATON_SEED_PILOT=1 pnpm --filter clickaton seed:pilot-edition
 */

import { pathToFileURL } from "node:url";
import { prisma } from "@repo/db";

export const PILOT_EDITION_SLUG = "piloto-test-11b";

export async function seedPilotEditionTest(): Promise<{
  editionId: string;
  slug: string;
  paidTicketId: string;
  freeTicketId: string;
}> {
  const now = new Date();
  const startAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + 10 * 60 * 60 * 1000);
  const registrationOpenAt = new Date(now.getTime() - 60 * 60 * 1000);
  const registrationCloseAt = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);

  const edition = await prisma.clickatonEdition.upsert({
    where: { slug: PILOT_EDITION_SLUG },
    create: {
      name: "Clickatón Piloto TEST 11B",
      slug: PILOT_EDITION_SLUG,
      shortDescription:
        "Edición piloto TEST para validar inscripción, pago sandbox, QR y Mi cuenta.",
      description:
        "No es una venta comercial. Entorno inequívocamente TEST. Incluye entrada paga sandbox y entrada gratuita.",
      status: "REGISTRATION_OPEN",
      isPublished: true,
      registrationEnabled: true,
      timezone: "America/Argentina/Buenos_Aires",
      country: "AR",
      currency: "ARS",
      location: "TEST",
      startAt,
      endAt,
      registrationOpenAt,
      registrationCloseAt,
      defaultCapacity: 50,
      visibleCodePrefix: "T11B",
    },
    update: {
      name: "Clickatón Piloto TEST 11B",
      shortDescription:
        "Edición piloto TEST para validar inscripción, pago sandbox, QR y Mi cuenta.",
      status: "REGISTRATION_OPEN",
      isPublished: true,
      registrationEnabled: true,
      country: "AR",
      currency: "ARS",
      registrationOpenAt,
      registrationCloseAt,
      startAt,
      endAt,
      defaultCapacity: 50,
      visibleCodePrefix: "T11B",
    },
  });

  const venue = await prisma.clickatonVenue.upsert({
    where: {
      editionId_slug: { editionId: edition.id, slug: "sede-test" },
    },
    create: {
      editionId: edition.id,
      name: "Sede TEST Centro",
      slug: "sede-test",
      city: "Ciudad TEST",
      provinceOrState: "Provincia TEST",
      country: "AR",
      address: "Plaza TEST 100",
      meetingPoint: "Ingreso principal — cartel TEST",
      capacity: 50,
      isActive: true,
    },
    update: {
      name: "Sede TEST Centro",
      city: "Ciudad TEST",
      isActive: true,
      capacity: 50,
    },
  });

  const paid = await prisma.clickatonTicketType.upsert({
    where: {
      editionId_code: { editionId: edition.id, code: "PAID_TEST" },
    },
    create: {
      editionId: edition.id,
      venueId: venue.id,
      name: "Entrada general TEST",
      description: "Entrada paga sandbox — sin cobro real.",
      code: "PAID_TEST",
      priceAmount: 100000,
      currency: "ARS",
      capacity: 40,
      holdMinutes: 20,
      isActive: true,
      salesStartAt: registrationOpenAt,
      salesEndAt: registrationCloseAt,
    },
    update: {
      priceAmount: 100000,
      isActive: true,
      capacity: 40,
      holdMinutes: 20,
      salesStartAt: registrationOpenAt,
      salesEndAt: registrationCloseAt,
      venueId: venue.id,
    },
  });

  const free = await prisma.clickatonTicketType.upsert({
    where: {
      editionId_code: { editionId: edition.id, code: "FREE_TEST" },
    },
    create: {
      editionId: edition.id,
      venueId: venue.id,
      name: "Entrada cortesía TEST",
      description: "Entrada gratuita — confirmación automática.",
      code: "FREE_TEST",
      priceAmount: 0,
      currency: "ARS",
      capacity: 10,
      holdMinutes: 20,
      isActive: true,
      salesStartAt: registrationOpenAt,
      salesEndAt: registrationCloseAt,
    },
    update: {
      priceAmount: 0,
      isActive: true,
      capacity: 10,
      salesStartAt: registrationOpenAt,
      salesEndAt: registrationCloseAt,
      venueId: venue.id,
    },
  });

  return {
    editionId: edition.id,
    slug: edition.slug,
    paidTicketId: paid.id,
    freeTicketId: free.id,
  };
}

async function main() {
  if (process.env.CLICKATON_SEED_PILOT !== "1") {
    console.error("Set CLICKATON_SEED_PILOT=1 to run.");
    process.exit(1);
  }
  const result = await seedPilotEditionTest();
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
        note: "TEST pilot edition upserted. Not for production sale.",
      },
      null,
      2,
    ),
  );
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
