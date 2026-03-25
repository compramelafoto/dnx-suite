/**
 * Seed: categorías de Comunidad (Para fotógrafos + Proveedores) y 5 entidades iniciales "Para fotógrafos".
 * Ejecutar: npm run seed:community  (o tsx scripts/seed-community.ts)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const EVENT_VENDOR_CATEGORIES = [
  "Makeup / Maquillaje",
  "Peinado / Peluquería",
  "Manicura / Uñas",
  "Vestidos",
  "Trajes",
  "Calzado / Zapatería",
  "Tocados",
  "Decoración / Ambientación",
  "Flores / Florista",
  "Catering",
  "Pastelería / Mesa dulce",
  "Barra / Bartender",
  "DJ",
  "Sonido e Iluminación",
  "Animación / Show",
  "Salón / Quinta",
  "Cabina de fotos",
  "Plataforma 360",
  "Glitter bar",
  "Organización de eventos",
  "Transporte",
  "Seguridad",
  "Invitaciones / Papelería",
  "Souvenirs",
  "Otro",
];

const PHOTOGRAPHER_SERVICE_CATEGORIES = [
  "Tienda / Accesorios",
  "Laboratorio / Impresión",
  "Software / SaaS",
  "Educación / Cursos",
  "Comunidad / Asociación",
  "Comunidad / Asesoramiento",
  "Comunidad / salidas fotográficas",
  "Alquiler de equipos",
  "Seguros",
  "Servicios de edición / post",
  "Marketing / Ads",
  "Otro",
];

async function seedCategories() {
  console.log("📁 Seed categorías EVENT_VENDOR...");
  for (let i = 0; i < EVENT_VENDOR_CATEGORIES.length; i++) {
    const name = EVENT_VENDOR_CATEGORIES[i];
    const slug = slugFromName(name);
    await prisma.communityCategory.upsert({
      where: {
        type_slug: { type: "EVENT_VENDOR", slug },
      },
      update: { name, order: i },
      create: {
        type: "EVENT_VENDOR",
        name,
        slug,
        order: i,
      },
    });
  }
  console.log("📁 Seed categorías PHOTOGRAPHER_SERVICE...");
  for (let i = 0; i < PHOTOGRAPHER_SERVICE_CATEGORIES.length; i++) {
    const name = PHOTOGRAPHER_SERVICE_CATEGORIES[i];
    const slug = slugFromName(name);
    await prisma.communityCategory.upsert({
      where: {
        type_slug: { type: "PHOTOGRAPHER_SERVICE", slug },
      },
      update: { name, order: i },
      create: {
        type: "PHOTOGRAPHER_SERVICE",
        name,
        slug,
        order: i,
      },
    });
  }
}

async function ensureCategory(
  type: "PHOTOGRAPHER_SERVICE" | "EVENT_VENDOR",
  name: string
): Promise<number> {
  const slug = slugFromName(name);
  const cat = await prisma.communityCategory.upsert({
    where: { type_slug: { type, slug } },
    update: {},
    create: { type, name, slug, order: 999 },
  });
  return cat.id;
}

async function upsertPhotographerServiceProfile(data: {
  name: string;
  slug: string;
  province?: string;
  city?: string;
  email?: string;
  emailNormalized?: string;
  whatsapp?: string;
  whatsappNormalized?: string;
  website?: string;
  instagram?: string;
  address?: string;
  categorySlugs: string[];
}) {
  const emailNorm = data.email ? data.email.toLowerCase().trim() : undefined;
  const whatsappNorm = data.whatsapp
    ? data.whatsapp.replace(/\D/g, "")
    : undefined;

  const existingByEmail = emailNorm
    ? await prisma.communityProfile.findUnique({
        where: {
          type_emailNormalized: { type: "PHOTOGRAPHER_SERVICE", emailNormalized: emailNorm },
        },
      })
    : null;
  const existingByWhatsApp = whatsappNorm
    ? await prisma.communityProfile.findUnique({
        where: {
          type_whatsappNormalized: {
            type: "PHOTOGRAPHER_SERVICE",
            whatsappNormalized: whatsappNorm,
          },
        },
      })
    : null;
  const existingBySlug = await prisma.communityProfile.findUnique({
    where: { type_slug: { type: "PHOTOGRAPHER_SERVICE", slug: data.slug } },
  });

  const existing = existingByEmail || existingByWhatsApp || existingBySlug;
  const categoryIds: number[] = [];
  for (const slug of data.categorySlugs) {
    const c = await prisma.communityCategory.findFirst({
      where: { type: "PHOTOGRAPHER_SERVICE", slug },
    });
    if (c) categoryIds.push(c.id);
  }
  if (categoryIds.length === 0) {
    const other = await prisma.communityCategory.findFirst({
      where: { type: "PHOTOGRAPHER_SERVICE", slug: "otro" },
    });
    if (other) categoryIds.push(other.id);
  }

  const payload = {
    type: "PHOTOGRAPHER_SERVICE" as const,
    status: "ACTIVE" as const,
    name: data.name,
    slug: data.slug,
    province: data.province ?? null,
    city: data.city ?? null,
    address: data.address ?? null,
    email: data.email ?? null,
    emailNormalized: emailNorm ?? null,
    whatsapp: data.whatsapp ?? null,
    whatsappNormalized: whatsappNorm ?? null,
    website: data.website ?? null,
    instagram: data.instagram ?? null,
    facebook: null,
    tiktok: null,
    youtube: null,
    description: null,
    contactName: null,
  };

  if (existing) {
    await prisma.communityProfile.update({
      where: { id: existing.id },
      data: payload,
    });
    await prisma.communityProfileCategory.deleteMany({
      where: { profileId: existing.id },
    });
    for (const categoryId of categoryIds) {
      await prisma.communityProfileCategory.create({
        data: { profileId: existing.id, categoryId },
      });
    }
    console.log("  ✅ Actualizado:", data.name);
    return existing.id;
  }

  const created = await prisma.communityProfile.create({
    data: {
      ...payload,
      categories: {
        create: categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });
  console.log("  ✅ Creado:", data.name);
  return created.id;
}

async function seedParaFotografos() {
  console.log("📷 Seed 5 entidades Para fotógrafos...");

  await upsertPhotographerServiceProfile({
    name: "Callejeando Rosario",
    slug: "callejeando-rosario",
    province: "Santa Fe",
    city: "Rosario",
    instagram: "callejeando_rosario",
    categorySlugs: ["comunidad-asociacion"],
  });

  await upsertPhotographerServiceProfile({
    name: "El Baúl del Fotógrafo",
    slug: "el-baul-del-fotografo",
    province: "Santa Fe",
    city: "Rosario",
    address: "Corrientes 1855",
    website: "https://elbauldelfotografo.empretienda.com.ar/",
    email: "marcos.piaggio@hotmail.com",
    whatsapp: "3413618099",
    categorySlugs: ["tienda-accesorios"],
  });

  await upsertPhotographerServiceProfile({
    name: "Sociedad de Fotógrafos Profesionales de Rosario (SFPR)",
    slug: "sfpr",
    province: "Santa Fe",
    city: "Rosario",
    address: "Ricchieri 426",
    website: "https://www.sfpr.com.ar/",
    email: "sfprosario@gmail.com",
    whatsapp: "3416811201",
    instagram: "sfprosario",
    categorySlugs: ["comunidad-asociacion", "educacion-cursos"],
  });

  await upsertPhotographerServiceProfile({
    name: "AFPER",
    slug: "afper",
    province: "Entre Ríos",
    city: "Paraná",
    address: "Pellegrini 585",
    whatsapp: "3434650561",
    instagram: "afperfotografos",
    categorySlugs: ["comunidad-asociacion"],
  });

  await upsertPhotographerServiceProfile({
    name: "Tarifario Fotográfico Argentina (TFA)",
    slug: "tarifario-fotografico-argentina",
    website: "https://www.tarifariofotograficoargentina.com.ar/",
    instagram: "tarifariofotograficoargentina",
    categorySlugs: ["comunidad-asesoramiento"],
  });
}

async function main() {
  console.log("🌱 Seed Comunidad (categorías + Para fotógrafos)...\n");
  await seedCategories();
  await seedParaFotografos();
  console.log("\n✨ Seed comunidad completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
