/**
 * Edición DEMO oculta de Clickatón.
 *
 * - Oculta: `isOpsFixture: true` la saca de home, /maratones y del carousel.
 *   Sigue siendo accesible por link directo a /maratones/clickaton-demo.
 * - Gratuita: una sola entrada con precio 0 (sin pasar por Mercado Pago).
 * - 3 consignas en vez de 10, con liberación programada.
 * - Ventana: 2026-09-02 de 10:00 a 12:00 (America/Argentina/Buenos_Aires).
 *
 * Idempotente: se puede volver a correr sin duplicar nada.
 *
 * Uso:
 *   CLICKATON_SEED_DEMO=1 pnpm --filter clickaton seed:demo-edition
 */

import { pathToFileURL } from "node:url";
import { prisma } from "@repo/db";
import {
  activateTimeline,
  ensureDraftTimeline,
  getActiveTimeline,
} from "@/lib/timeline/prisma-timeline";

export const DEMO_EDITION_SLUG = "clickaton-demo";
const DEMO_CONTEST_SLUG = "clickaton-demo-oculta";
/**
 * Nada de identificadores fijos: cada base (producción, staging, local) tiene los
 * suyos. Se resuelven por email y por slug, y si falta algo el guion falla fuerte.
 */
const OWNER_EMAIL = "dnxfotografia@gmail.com";
const TIMEZONE = "America/Argentina/Buenos_Aires";

/** Argentina es UTC-3: 10:00 local = 13:00 UTC. */
const at = (utcIso: string) => new Date(utcIso);

const START_AT = at("2026-09-02T13:00:00.000Z"); // 10:00
const END_AT = at("2026-09-02T15:00:00.000Z"); // 12:00
const REGISTRATION_OPEN_AT = at("2026-09-01T12:00:00.000Z");
/** Se puede entrar por el link incluso empezada la demo. */
const REGISTRATION_CLOSE_AT = END_AT;
/** Dos horas extra para subir: se fotografía hasta las 12:00, se entrega hasta las 14:00. */
const UPLOAD_ENDS_AT = at("2026-09-02T17:00:00.000Z"); // 14:00
/** Acreditación: abierta toda la jornada para que el escáner funcione siempre. */
const ACCREDITATION_OPENS_AT = at("2026-09-02T10:00:00.000Z"); // 07:00
const ACCREDITATION_CLOSES_AT = at("2026-09-02T15:00:00.000Z"); // 12:00
const RESULTS_AT = at("2026-09-02T18:00:00.000Z"); // 15:00

const PROMPTS = [
  {
    sequence: 1,
    internalName: "Luz y sombra",
    title: "Luz y sombra",
    shortDescription: "El contraste como protagonista.",
    instructions:
      "Buscá una escena donde la luz y la sombra convivan en el mismo encuadre. No vale simular el contraste en edición.",
    revealAt: at("2026-09-02T13:00:00.000Z"), // 10:00
  },
  {
    sequence: 2,
    internalName: "Un color que manda",
    title: "Un color que manda",
    shortDescription: "Una fotografía dominada por un solo color.",
    instructions:
      "Un color debe ordenar toda la imagen. Puede ser un objeto, una pared, una prenda o la luz misma.",
    revealAt: at("2026-09-02T13:40:00.000Z"), // 10:40
  },
  {
    sequence: 3,
    internalName: "Movimiento",
    title: "Movimiento",
    shortDescription: "Algo que se mueve, congelado o barrido.",
    instructions:
      "Mostrá movimiento real en la escena. Congelado o con barrido: la decisión técnica es tuya.",
    revealAt: at("2026-09-02T14:20:00.000Z"), // 11:20
  },
] as const;

export async function seedClickatonDemoEdition() {
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: { id: true },
  });
  if (!owner) {
    throw new Error(
      `No existe el usuario ${OWNER_EMAIL} en esta base. Revisá a qué base estás apuntando.`,
    );
  }

  // La base de producción puede estar atrás del esquema del repo. Si las tablas de
  // FotoRank no tienen todas las columnas, la demo se crea igual: se pierde la subida
  // de fotografías, pero inscripción, acreditación y consignas siguen funcionando.
  // Se avisa fuerte en vez de fallar en silencio.
  // 0. Organización FotoRank propia de la demo.
  const organization = await prisma.contestOrganization.upsert({
    where: { slug: DEMO_CONTEST_SLUG },
    create: {
      name: "Clickatón DEMO (oculta)",
      slug: DEMO_CONTEST_SLUG,
      shortDescription: "Organización de prueba. No corresponde a una entidad real.",
      createdByUser: { connect: { id: owner.id } },
    },
    update: { name: "Clickatón DEMO (oculta)" },
  });

  // 1. Concurso FotoRank propio: la demo nunca mezcla obras con la edición real.
  const contestId = `demo-${DEMO_CONTEST_SLUG}`;
  let contestReady = false;
  try {
    await prisma.fotorankContest.upsert({
    where: { id: contestId },
    create: {
      id: contestId,
      organization: { connect: { id: organization.id } },
      title: "Clickatón DEMO (oculta)",
      slug: DEMO_CONTEST_SLUG,
      shortDescription: "Concurso de prueba asociado a la edición DEMO de Clickatón.",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      experienceType: "MARATHON",
      distributionChannel: "CLICKATON",
      registrationEnabled: false,
      timezone: TIMEZONE,
      createdByUser: { connect: { id: owner.id } },
    },
    update: {
      title: "Clickatón DEMO (oculta)",
      visibility: "PRIVATE",
      distributionChannel: "CLICKATON",
      timezone: TIMEZONE,
    },
  });

  await prisma.fotorankContestCategory.upsert({
      where: { contestId_slug: { contestId, slug: "general" } },
    create: {
        contest: { connect: { id: contestId } },
      name: "General",
      slug: "general",
      status: "ACTIVE",
      maxFiles: 1,
      sortOrder: 0,
    },
    update: { status: "ACTIVE" },
  });
    contestReady = true;
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    console.warn(
      [
        "AVISO: no se pudo preparar el concurso FotoRank de la demo.",
        "La edición se crea igual, pero la SUBIDA DE FOTOGRAFÍAS quedará deshabilitada",
        "(el servicio exige una edición vinculada a un concurso).",
        `Motivo: ${detalle}`,
      ].join(" "),
    );
  }

  // 2. Edición oculta.
  const editionData = {
    name: "Clickatón DEMO",
    shortDescription:
      "Edición de prueba oculta: inscripción gratuita, 3 consignas, dos horas.",
    description:
      "Réplica reducida de Clickatón para probar el circuito completo: inscripción, acreditación, liberación de consignas y entrega de fotografías. No es una edición comercial ni anunciada.",
    status: "REGISTRATION_OPEN" as const,
    isPublished: true,
    isOpsFixture: true,
    registrationEnabled: true,
    timezone: TIMEZONE,
    country: "AR",
    currency: "ARS",
    location: "Ecoparque de San Nicolás",
    city: "San Nicolás",
    provinceOrState: "Buenos Aires",
    startAt: START_AT,
    endAt: END_AT,
    registrationOpenAt: REGISTRATION_OPEN_AT,
    registrationCloseAt: REGISTRATION_CLOSE_AT,
    defaultCapacity: 20,
    visibleCodePrefix: "DEMO",
    fotorankContestId: contestReady ? contestId : null,
  };

  const edition = await prisma.clickatonEdition.upsert({
    where: { slug: DEMO_EDITION_SLUG },
    create: { slug: DEMO_EDITION_SLUG, ...editionData },
    update: editionData,
  });

  // 3. Sede.
  const venue = await prisma.clickatonVenue.upsert({
    where: { editionId_slug: { editionId: edition.id, slug: "sede-demo" } },
    create: {
      editionId: edition.id,
      name: "Ecoparque de San Nicolás",
      slug: "sede-demo",
      city: "San Nicolás",
      provinceOrState: "Buenos Aires",
      country: "AR",
      meetingPoint: "Ingreso principal del Ecoparque",
      capacity: 20,
      isActive: true,
    },
    update: {
      name: "Ecoparque de San Nicolás",
      city: "San Nicolás",
      provinceOrState: "Buenos Aires",
      meetingPoint: "Ingreso principal del Ecoparque",
      capacity: 20,
      isActive: true,
    },
  });

  // 4. Entrada gratuita.
  const ticket = await prisma.clickatonTicketType.upsert({
    where: { editionId_code: { editionId: edition.id, code: "DEMO_FREE" } },
    create: {
      editionId: edition.id,
      venueId: venue.id,
      name: "Inscripción DEMO (gratuita)",
      description: "Inscripción sin costo. No se cobra ni se emite comprobante fiscal.",
      code: "DEMO_FREE",
      priceAmount: 0,
      currency: "ARS",
      capacity: 20,
      holdMinutes: 20,
      isActive: true,
      salesStartAt: REGISTRATION_OPEN_AT,
      salesEndAt: REGISTRATION_CLOSE_AT,
    },
    update: {
      priceAmount: 0,
      isActive: true,
      capacity: 20,
      venueId: venue.id,
      salesStartAt: REGISTRATION_OPEN_AT,
      salesEndAt: REGISTRATION_CLOSE_AT,
    },
  });

  // 4b. Nada pago en la demo. Otros mecanismos (packs) dan de alta entradas por
  // edición automáticamente; si alguna quedara activa, un invitado podría llegar a
  // un cobro real de Mercado Pago desde una edición de prueba.
  const desactivadas = await prisma.clickatonTicketType.updateMany({
    where: { editionId: edition.id, code: { not: "DEMO_FREE" }, isActive: true },
    data: { isActive: false },
  });

  // 5. Configuración de subida: ventanas por consigna, sin reveal global.
  // En la demo la exigencia técnica no debe frenar a nadie: lo que se prueba es el
  // circuito, no la calidad del archivo. Se bajan los mínimos y se permiten los
  // casos que normalmente rebotan (misma foto en varias consignas, coincidencias
  // entre participantes). Una edición real usa los valores por defecto, más estrictos.
  const uploadConfig = {
    uploadsEnabled: true,
    globalPromptReveal: false,
    eventRevealAt: START_AT,
    captureWindowStartsAt: START_AT,
    captureWindowEndsAt: END_AT,
    uploadWindowStartsAt: START_AT,
    uploadWindowEndsAt: UPLOAD_ENDS_AT,
    allowReplacement: true,
    /** Cualquier foto de celular entra; sólo se frena un archivo ilegible. */
    minWidth: 200,
    minHeight: 200,
    maxWidth: 20000,
    maxHeight: 20000,
    maxFileSizeBytes: 26_214_400,
    /** Se puede usar la misma foto en más de una consigna. */
    allowCrossPromptDuplicate: true,
    /** Que dos participantes suban algo parecido no frena ni marca nada. */
    blockCrossParticipantDuplicate: false,
    reviewCrossParticipantDuplicate: false,
    /** Reloj del celular desfasado: no queremos avisos por eso en una prueba. */
    captureClockToleranceMinutes: 120,
  };
  await prisma.clickatonEditionUploadConfig.upsert({
    where: { editionId: edition.id },
    create: { editionId: edition.id, ...uploadConfig },
    update: uploadConfig,
  });

  // 6. Acreditación con QR.
  await prisma.clickatonEditionAccreditationConfig.upsert({
    where: { editionId: edition.id },
    create: {
      editionId: edition.id,
      accreditationEnabled: true,
      identityMode: "VISUAL",
      geofenceMode: "OFF",
      shortCodeEnabled: true,
      allowOfflineEvents: true,
    },
    update: { accreditationEnabled: true, shortCodeEnabled: true, geofenceMode: "OFF" },
  });

  // 7. Las 3 consignas, programadas.
  const prompts = [];
  for (const p of PROMPTS) {
    const data = {
      internalName: p.internalName,
      title: p.title,
      shortDescription: p.shortDescription,
      instructions: p.instructions,
      status: "READY" as const,
      releaseMode: "SCHEDULED" as const,
      releasedAt: null,
      captureStartsAt: p.revealAt,
      captureEndsAt: END_AT,
      uploadStartsAt: p.revealAt,
      uploadEndsAt: UPLOAD_ENDS_AT,
      minEntries: 0,
      maxEntries: 1,
      allowReplacement: true,
      required: false,
      gpsMode: "OPTIONAL" as const,
    };
    const prompt = await prisma.clickatonPrompt.upsert({
      where: { editionId_sequence: { editionId: edition.id, sequence: p.sequence } },
      create: { editionId: edition.id, sequence: p.sequence, ...data },
      update: data,
    });
    prompts.push({
      sequence: prompt.sequence,
      id: prompt.id,
      revealAt: p.revealAt.toISOString(),
    });
  }

  // 8. Cronograma. Sin esto la acreditación queda deshabilitada: el escáner
  // resuelve la ventana de check-in a partir de los eventos ACCREDITATION_OPEN /
  // ACCREDITATION_CLOSE, y sin cronograma activo esconde el botón de confirmar.
  const draft = await ensureDraftTimeline(edition.id, owner.id);
  const horarios: Record<string, { startsAt: Date | null; endsAt?: Date | null }> = {
    REGISTRATION_OPEN: { startsAt: REGISTRATION_OPEN_AT },
    REGISTRATION_CLOSE: { startsAt: REGISTRATION_CLOSE_AT },
    ACCREDITATION_OPEN: { startsAt: ACCREDITATION_OPENS_AT },
    ACCREDITATION_CLOSE: { startsAt: ACCREDITATION_CLOSES_AT },
    MARATHON_START: { startsAt: START_AT },
    PROMPT_RELEASE: { startsAt: START_AT },
    CAPTURE_WINDOW_CLOSE: { startsAt: END_AT },
    UPLOAD_WINDOW_OPEN: { startsAt: START_AT },
    UPLOAD_WINDOW_CLOSE: { startsAt: UPLOAD_ENDS_AT },
    MARATHON_END: { startsAt: END_AT },
    RESULTS_RELEASE: { startsAt: RESULTS_AT },
  };
  const nombres: Record<string, string> = {
    ACCREDITATION_OPEN: "Acreditación en el Ecoparque de San Nicolás",
    RESULTS_RELEASE: "Resultados",
  };
  for (const evento of draft.events) {
    const h = horarios[evento.eventType];
    if (!h) continue;
    await prisma.clickatonTimelineEvent.update({
      where: { id: evento.id },
      data: {
        startsAt: h.startsAt,
        endsAt: h.endsAt ?? null,
        name: nombres[evento.eventType] ?? evento.name,
        visibilityPolicy: "PUBLIC_SAFE",
      },
    });
  }
  const yaActivo = await getActiveTimeline(edition.id);
  if (!yaActivo || yaActivo.id !== draft.id) {
    await activateTimeline(draft.id, owner.id);
  }

  return {
    editionId: edition.id,
    cronogramaId: draft.id,
    slug: edition.slug,
    organizationId: organization.id,
    contestId: contestReady ? contestId : null,
    venueId: venue.id,
    ticketTypeId: ticket.id,
    entradasPagasDesactivadas: desactivadas.count,
    prompts,
    publicUrl: `https://maratonfotografica.com/maratones/${edition.slug}`,
  };
}

async function main() {
  if (process.env.CLICKATON_SEED_DEMO !== "1") {
    console.error("Set CLICKATON_SEED_DEMO=1 to run.");
    process.exit(1);
  }
  const result = await seedClickatonDemoEdition();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
