/**
 * Seed demo de eventos Info Spot — SOLO staging/desarrollo.
 *
 * Bloqueado si NODE_ENV=production salvo ALLOW_INFOSPOT_DEMO_SEED=1.
 *
 * Uso:
 *   pnpm --filter @repo/db exec tsx prisma/scripts/seed-infospot-demo-events.ts
 *   # o
 *   pnpm --filter @repo/db db:seed:infospot-events
 */
import { prisma } from "../../src/client.js";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_INFOSPOT_DEMO_SEED !== "1") {
  console.error("Bloqueado en production. Set ALLOW_INFOSPOT_DEMO_SEED=1 solo si es intencional.");
  process.exit(1);
}

function daysFromNow(days: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const demos = [
  {
    title: "Clásico barrial: Atlético Norte vs Sur",
    slug: "demo-clasico-barrial-atletico",
    summary: "Derbi local con gradas llenas y rivalidad sana.",
    description:
      "Partido amistoso de fútbol amateur con entrada libre. Ideal para cobertura fotográfica de ambiente y acción.\n\nHorario de puertas: 15:30.",
    categorySlug: "deportes",
    organizerName: "Liga Barrial Norte",
    organizerEmail: "demo-liga@example.com",
    city: "Córdoba",
    province: "Córdoba",
    venueName: "Cancha Atlético Norte",
    latitude: -31.4201,
    longitude: -64.1888,
    startAt: daysFromNow(12, 16),
    endAt: daysFromNow(12, 18),
    theme: "deporte",
  },
  {
    title: "Feria de diseño independiente",
    slug: "demo-feria-diseno-independiente",
    summary: "Diseñadores locales, talleres y música en vivo.",
    description:
      "Una jornada cultural con stands, charlas cortas y espacio para familias. Traé tu cámara: hay mucha textura y color.",
    categorySlug: "cultura",
    organizerName: "Colectivo Plaza Abierta",
    organizerEmail: "demo-cultura@example.com",
    city: "Rosario",
    province: "Santa Fe",
    venueName: "Plaza San Martín",
    latitude: -32.9442,
    longitude: -60.6505,
    startAt: daysFromNow(5, 11),
    endAt: daysFromNow(5, 20),
    theme: "cultura",
  },
  {
    title: "Recital al aire libre: Noche de bandas",
    slug: "demo-recital-noche-bandas",
    summary: "Tres bandas locales en escenario abierto.",
    description:
      "Programación musical con foco en artistas emergentes. Se recomienda llegar temprano. Sin venta de alcohol en el predio.",
    categorySlug: "cultura",
    organizerName: "Escena Viva",
    organizerEmail: "demo-recital@example.com",
    city: "Santa Fe",
    province: "Santa Fe",
    venueName: "Anfiteatro Costanera",
    latitude: -31.6333,
    longitude: -60.7,
    startAt: daysFromNow(9, 21),
    endAt: daysFromNow(9, 23),
    registrationUrl: "https://example.com/inscripcion-recital",
    theme: "recital",
  },
  {
    title: "Carrera 10K Costanera",
    slug: "demo-carrera-10k-costanera",
    summary: "Running urbano con kit y cronometraje.",
    description:
      "Circuito costero de 10 kilómetros. Categorías general y masters. Inscripción online hasta 48 hs antes.",
    categorySlug: "deportes",
    organizerName: "Runners del Río",
    organizerEmail: "demo-running@example.com",
    city: "Buenos Aires",
    province: "CABA",
    venueName: "Costanera Sur",
    address: "Av. España y Brasil",
    latitude: -34.6037,
    longitude: -58.3816,
    startAt: daysFromNow(18, 8),
    endAt: daysFromNow(18, 11),
    registrationUrl: "https://example.com/10k-costanera",
    theme: "running",
  },
  {
    title: "Rally regional: etapa de montaña",
    slug: "demo-rally-etapa-montana",
    summary: "Automovilismo de velocidad en tramos cerrados.",
    description:
      "Espectadores en zonas habilitadas. Traé teleobjetivo si vas a cubrir. Respetá las indicaciones de seguridad de la organización.",
    categorySlug: "deportes",
    organizerName: "Automóvil Club Regional",
    organizerEmail: "demo-rally@example.com",
    city: "Villa Carlos Paz",
    province: "Córdoba",
    venueName: "Tramo El Condor",
    latitude: -31.4241,
    longitude: -64.4978,
    startAt: daysFromNow(22, 9),
    endAt: daysFromNow(22, 17),
    theme: "automovilismo",
  },
  {
    title: "Workshop de fotografía de eventos",
    slug: "demo-workshop-fotografia-eventos",
    summary: "Taller práctico para cubrir con mirada editorial.",
    description:
      "Sesión de 4 horas: luz disponible, ética de cobertura y edición rápida. Cupos limitados.",
    categorySlug: "fotografia",
    organizerName: "Info Spot Lab",
    organizerEmail: "demo-foto@example.com",
    city: "Buenos Aires",
    province: "CABA",
    venueName: "Espacio Cultural Palermo",
    latitude: -34.5875,
    longitude: -58.425,
    startAt: daysFromNow(7, 14),
    endAt: daysFromNow(7, 18),
    registrationUrl: "https://example.com/workshop-foto",
    theme: "fotografia",
  },
  {
    title: "Torneo escolar de básquet",
    slug: "demo-torneo-escolar-basquet",
    summary: "Finales intercolegiales en gimnasio municipal.",
    description:
      "Jornada de finales con tres partidos. Ideal para fotógrafos que buscan acción indoor y retratos de equipo.",
    categorySlug: "deportes",
    organizerName: "Dirección de Deportes Municipal",
    organizerEmail: "demo-basquet@example.com",
    city: "Mendoza",
    province: "Mendoza",
    venueName: "Gimnasio Municipal N°2",
    latitude: -32.8895,
    longitude: -68.8458,
    startAt: daysFromNow(-14, 15),
    endAt: daysFromNow(-14, 20),
    theme: "deporte",
  },
  {
    title: "Muestra fotográfica: Miradas del barrio",
    slug: "demo-muestra-miradas-barrio",
    summary: "Exposición colectiva de fotógrafos locales.",
    description:
      "Apertura con recorrido guiado. Obras en papel y proyección. Entrada libre y gratuita.",
    categorySlug: "fotografia",
    organizerName: "Colectivo Óptica Sur",
    organizerEmail: "demo-muestra@example.com",
    city: "La Plata",
    province: "Buenos Aires",
    venueName: "Centro Cultural Pasaje Dardo Rocha",
    latitude: -34.9214,
    longitude: -57.9544,
    startAt: daysFromNow(3, 19),
    endAt: daysFromNow(3, 22),
    theme: "fotografia",
  },
] as const;

async function main() {
  // Asegurar categorías base
  for (const category of [
    { name: "Deportes", slug: "deportes" },
    { name: "Cultura", slug: "cultura" },
    { name: "Fotografía", slug: "fotografia" },
    { name: "Eventos", slug: "eventos" },
  ] as const) {
    await prisma.infoSpotCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: { name: category.name, slug: category.slug },
    });
  }

  let created = 0;
  for (const demo of demos) {
    const category = await prisma.infoSpotCategory.findUnique({
      where: { slug: demo.categorySlug },
      select: { id: true },
    });

    await prisma.infoSpotEvent.upsert({
      where: { slug: demo.slug },
      update: {
        title: demo.title,
        summary: demo.summary,
        description: demo.description,
        categoryId: category?.id ?? null,
        organizerName: demo.organizerName,
        organizerEmail: demo.organizerEmail,
        city: demo.city,
        province: demo.province,
        venueName: demo.venueName,
        address: "address" in demo ? demo.address : null,
        latitude: demo.latitude,
        longitude: demo.longitude,
        startAt: demo.startAt,
        endAt: demo.endAt,
        registrationUrl: "registrationUrl" in demo ? demo.registrationUrl : null,
        status: "PUBLISHED",
        publishedAt: new Date(),
        contentTag: "DEMO",
      },
      create: {
        title: demo.title,
        slug: demo.slug,
        summary: demo.summary,
        description: demo.description,
        categoryId: category?.id ?? null,
        organizerName: demo.organizerName,
        organizerEmail: demo.organizerEmail,
        city: demo.city,
        province: demo.province,
        venueName: demo.venueName,
        address: "address" in demo ? demo.address : null,
        latitude: demo.latitude,
        longitude: demo.longitude,
        startAt: demo.startAt,
        endAt: demo.endAt,
        registrationUrl: "registrationUrl" in demo ? demo.registrationUrl : null,
        status: "PUBLISHED",
        publishedAt: new Date(),
        contentTag: "DEMO",
        submission: {
          create: {
            status: "APPROVED",
            reviewedAt: new Date(),
            ipHash: null,
            userAgent: "seed-infospot-demo-events",
          },
        },
      },
    });
    created += 1;
  }

  console.log(`Info Spot demo events OK: ${created} eventos (PUBLISHED).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
