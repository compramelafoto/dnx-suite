/**
 * Crea el evento «Álvarez Corre» (Zona Atletismo #22) para compramelafoto@gmail.com
 *
 * Uso: npx tsx scripts/seed-alvarez-corre-event.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import {
  EventJoinPolicy,
  EventPhotoPricingMode,
  EventStatus,
  EventType,
  EventVisibility,
  PrismaClient,
  Role,
} from "@prisma/client";
import { encodeGeohash } from "../lib/geo";

const prisma = new PrismaClient();

const ORGANIZER_EMAIL = "compramelafoto@gmail.com";
const EVENT_SHARE_SLUG = "alvarez-corre-2026";
const EVENT_TITLE = "Álvarez Corre";

const LAT = -33.12246859724316;
const LNG = -60.80507405678504;
const CITY = "Álvarez, Santa Fe";

const DESCRIPTION = `Primera edición de Álvarez Corre — carrera de running en Álvarez, Santa Fe.

📅 Sábado 30 de mayo de 2026
📍 Largada 17:00 hs — Sportivo Fútbol Club
🎽 Entrega de kits — Camping Club Sportivo Álvarez (horario a confirmar)

Distancias
• 8K competitivos — categorías por año cumplido: hasta 19 · 20-24 · 25-29 · 30-34 · 35-39 · 40-44 · 45-49 · 50-54 · 55-59 · 60-64 · +70
• 4K integrativos — 1° 2° 3° damas y 1° 2° 3° caballeros

Premios generales 8K (damas y caballeros)
🥇 1° $150.000 · 🥈 2° $120.000 · 🥉 3° $90.000

Inscripción oficial (Zona Atletismo): $35.000 — formulario y comprobante en el enlace de inscripción externa.

Fuente: Zona Atletismo — sportingEvents/22`;

const ACCREDITATION_NOTES = `Acreditación fotógrafos
• Presentarse con DNI en el punto de acreditación del evento (se informará por este canal).
• Largada 17:00 hs en Sportivo Fútbol Club, Álvarez.

Inscripción corredores (referencia Zona Atletismo)
• Formulario: https://forms.gle/864P1rtF8yk2LyGDA
• Consultas inscripción: WhatsApp 3400660640 (Zona Atletismo)
• Pago carrera: transferencia titular Carlos Emanuel Lopez — alias alvarez.corre — $35.000
• Cambios de inscripción: hasta 5 días antes del evento
• No hay inscripción el día de la carrera`;

const PHOTOGRAPHER_TERMS = `Condiciones para fotógrafos del evento
• Máximo 3 fotógrafos acreditados en la plataforma.
• Subir solo material del evento Álvarez Corre (30/05/2026).
• Respetar la privacidad de menores y no obstaculizar el circuito.
• Las ventas de fotos las define cada fotógrafo en su álbum (sin comisión del organizador en este evento).`;

const FOLDERS = [
  { name: "8K Competitivos", slug: "8k-competitivos" },
  { name: "4K Integrativos", slug: "4k-integrativos" },
  { name: "Largada y meta", slug: "largada-meta" },
  { name: "Premiación", slug: "premiacion" },
];

async function main() {
  const organizer = await prisma.user.findUnique({
    where: { email: ORGANIZER_EMAIL },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!organizer) {
    throw new Error(
      `No existe el usuario ${ORGANIZER_EMAIL}. Creá la cuenta o indicá otro email de organizador.`
    );
  }

  if (organizer.role !== Role.ORGANIZER && organizer.role !== Role.ADMIN) {
    await prisma.user.update({
      where: { id: organizer.id },
      data: { role: Role.ORGANIZER },
    });
    console.log(`[seed] Rol actualizado a ORGANIZER para ${ORGANIZER_EMAIL}`);
  }

  const startsAt = new Date("2026-05-30T20:00:00.000Z"); // 17:00 ART (UTC-3)
  const endsAt = new Date("2026-05-31T02:00:00.000Z"); // ~23:00 ART

  let event = await prisma.event.findFirst({
    where: {
      OR: [{ shareSlug: EVENT_SHARE_SLUG }, { title: EVENT_TITLE, creatorId: organizer.id }],
    },
  });

  const eventData = {
    title: EVENT_TITLE,
    description: DESCRIPTION,
    accreditationNotes: ACCREDITATION_NOTES,
    photographerTerms: PHOTOGRAPHER_TERMS,
    type: EventType.SPORTS,
    status: EventStatus.ACTIVE,
    startsAt,
    endsAt,
    latitude: LAT,
    longitude: LNG,
    locationName: "Sportivo Fútbol Club",
    city: CITY,
    geohash: encodeGeohash(LAT, LNG),
    visibility: EventVisibility.PUBLIC,
    joinPolicy: EventJoinPolicy.OPEN,
    maxPhotographers: 3,
    expectedAttendees: 1000,
    uploadsEnabled: true,
    organizerCommissionEnabled: false,
    organizerCommissionPercentage: null,
    organizerCommissionUpdatedAt: null,
    organizerCommissionUpdatedById: null,
    photoPricingMode: EventPhotoPricingMode.PHOTOGRAPHER_DECIDES,
    fixedPhotoPrice: null,
    minimumPhotoPrice: null,
    shareSlug: EVENT_SHARE_SLUG,
    creatorId: organizer.id,
  };

  if (event) {
    event = await prisma.event.update({
      where: { id: event.id },
      data: eventData,
    });
    console.log(`[seed] Evento actualizado id=${event.id}`);
  } else {
    event = await prisma.event.create({ data: eventData });
    console.log(`[seed] Evento creado id=${event.id}`);
  }

  for (const [i, folder] of FOLDERS.entries()) {
    await prisma.eventFolder.upsert({
      where: {
        eventId_slug: { eventId: event.id, slug: folder.slug },
      },
      create: {
        eventId: event.id,
        name: folder.name,
        slug: folder.slug,
        sortOrder: i,
        listedInPublicGallery: true,
        isActive: true,
        createdByUserId: organizer.id,
      },
      update: {
        name: folder.name,
        sortOrder: i,
        listedInPublicGallery: true,
        isActive: true,
      },
    });
  }

  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

  console.log("\n✅ Álvarez Corre listo\n");
  console.log(`Organizador: ${organizer.email} (id ${organizer.id})`);
  console.log(`Evento id: ${event.id}`);
  console.log(`Comisión organizador: desactivada`);
  console.log(`Fotógrafos máx.: 3 | Corredores estimados: ~1000`);
  console.log(`Panel: ${appUrl}/organizador/events/${event.id}`);
  console.log(`Convocatoria: ${appUrl}/e/${EVENT_SHARE_SLUG}`);
  console.log(`Galería: ${appUrl}/g/${EVENT_SHARE_SLUG}`);
}

main()
  .catch((err) => {
    console.error("[seed] Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
