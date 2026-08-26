/**
 * Seed: categorías, tags y autores iniciales del blog.
 * Ejecutar: npm run seed:blog
 */

import { PrismaClient } from "@prisma/client";

import { CLF_CONTENT_PLATFORM } from "../lib/blog/content-platform";

const prisma = new PrismaClient();

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const CATEGORIES = [
  {
    name: "ComprameLaFoto",
    slug: "compramelafoto",
    description: "Documentación y novedades de la plataforma ComprameLaFoto.",
    sortOrder: 0,
    isFeatured: true,
  },
  {
    name: "Fotografía escolar",
    slug: "fotografia-escolar",
    description: "Contenido sobre fotografía escolar, preventa y álbumes institucionales.",
    sortOrder: 1,
    isFeatured: false,
  },
  {
    name: "Fotografía deportiva",
    slug: "fotografia-deportiva",
    description: "Running, maratones, eventos deportivos y venta de fotos.",
    sortOrder: 2,
    isFeatured: false,
  },
  {
    name: "Negocio fotográfico",
    slug: "negocio-fotografico",
    description: "Marketing, ventas y gestión para fotógrafos profesionales.",
    sortOrder: 3,
    isFeatured: false,
  },
  {
    name: "Tecnología",
    slug: "tecnologia",
    description: "Herramientas, IA y tendencias tecnológicas para fotógrafos.",
    sortOrder: 4,
    isFeatured: false,
  },
  {
    name: "Herramientas para Fotógrafos",
    slug: "herramientas-para-fotografos",
    description: "Calculadoras, presupuestos y recursos para profesionalizar tu negocio fotográfico.",
    sortOrder: 5,
    isFeatured: false,
  },
] as const;

const TAGS = [
  "Running",
  "Maratón",
  "Fotografía deportiva",
  "Fotografía escolar",
  "Eventos",
  "Marketing",
  "Tecnología",
  "ComprameLaFoto",
] as const;

const AUTHORS = [
  {
    name: "Daniel Cuart",
    slug: "daniel-cuart",
    role: "Fundador",
    bio: "Fundador de ComprameLaFoto.",
  },
  {
    name: "Equipo ComprameLaFoto",
    slug: "equipo-compramelafoto",
    role: "Equipo CLF",
    bio: "Notas editoriales del equipo de ComprameLaFoto.",
  },
] as const;

async function seedCategories() {
  for (const category of CATEGORIES) {
    await prisma.blogCategory.upsert({
      where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: category.slug } },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isFeatured: category.isFeatured,
      },
      create: { ...category, platform: CLF_CONTENT_PLATFORM },
    });
    console.log(`  ✓ Categoría: ${category.name}`);
  }
}

async function seedTags() {
  for (const name of TAGS) {
    const slug = slugFromName(name);
    await prisma.blogTag.upsert({
      where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug } },
      update: { name },
      create: { platform: CLF_CONTENT_PLATFORM, name, slug },
    });
    console.log(`  ✓ Tag: ${name}`);
  }
}

async function seedAuthors() {
  for (const author of AUTHORS) {
    await prisma.blogAuthor.upsert({
      where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: author.slug } },
      update: {
        name: author.name,
        role: author.role,
        bio: author.bio,
        isActive: true,
      },
      create: {
        platform: CLF_CONTENT_PLATFORM,
        name: author.name,
        slug: author.slug,
        role: author.role,
        bio: author.bio,
        isActive: true,
      },
    });
    console.log(`  ✓ Autor: ${author.name}`);
  }
}

async function main() {
  console.log("🌱 Seed del blog — categorías, tags y autores\n");

  console.log("Categorías:");
  await seedCategories();

  console.log("\nTags:");
  await seedTags();

  console.log("\nAutores:");
  await seedAuthors();

  console.log("\n✅ Seed del blog completado.");
}

main()
  .catch((error) => {
    console.error("❌ Error en seed del blog:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
