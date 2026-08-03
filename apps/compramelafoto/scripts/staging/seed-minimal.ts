/**
 * Seed mínimo idempotente para staging ComprameLaFoto.
 *
 * Crea datos de prueba para: login, dashboard fotógrafo, home con álbumes,
 * galería pública, blog controlado y checkout digital básico (sin MP real).
 *
 * NO ejecutar contra producción. Requiere ALLOW_CLF_STAGING_MINIMAL_SEED=1.
 *
 * Uso (manual, contra staging):
 *   cd apps/compramelafoto
 *   export DATABASE_URL="..." DIRECT_URL="..."
 *   export ALLOW_CLF_STAGING_MINIMAL_SEED=1
 *   pnpm exec tsx scripts/staging/seed-minimal.ts
 */

import bcrypt from "bcryptjs";
import { BlogPostStatus, Role } from "@prisma/client";
import { prisma } from "@repo/db";
import { CLF_CONTENT_PLATFORM } from "../../lib/blog/content-platform";
import {
  createStagingPhoto,
  findStagingPhotoId,
  setAlbumCoverPhotoId,
  upsertStagingAlbum,
  upsertStagingUser,
} from "./staging-db-bridge";

/** Marcador estable en keys de R2 simuladas (no sube archivos reales). */
const SEED_MARKER = "staging/clf-minimal-v1";

const PHOTOGRAPHER_EMAIL = "fotografo.staging@clf.dnx.test";
const ADMIN_EMAIL = "admin.staging@clf.dnx.test";
const ALBUM_PUBLIC_SLUG = "staging-clf-demo-album";
const BLOG_POST_SLUG = "staging-clf-bienvenida";
const BLOG_CATEGORY_SLUG = "staging-clf";
const BLOG_AUTHOR_SLUG = "staging-clf-equipo";

const TERMS_VERSION = "2026-07-21";
const DIGITAL_PRICE_CENTS = 5000;

const PLACEHOLDER_PHOTOS = [
  {
    suffix: "01",
    previewUrl: "https://placehold.co/1200x800/png?text=CLF+Staging+01",
  },
  {
    suffix: "02",
    previewUrl: "https://placehold.co/1200x800/png?text=CLF+Staging+02",
  },
  {
    suffix: "03",
    previewUrl: "https://placehold.co/1200x800/png?text=CLF+Staging+03",
  },
] as const;

const PRODUCTION_HOST_PATTERNS = [
  /(^|[.-])prod(uction)?([.-]|$)/i,
  /compramelafoto-prod/i,
  /neon\.tech.*main$/i,
];

function resolveStagingPassword(): string {
  const fromEnv = process.env.CLF_STAGING_SEED_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return "StagingClf2026!";
}

function databaseHostname(databaseUrl: string): string | null {
  try {
    const normalized = databaseUrl.replace(/^postgresql:\/\//, "https://");
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

function assertSafeStagingSeed(): void {
  if (process.env.ALLOW_CLF_STAGING_MINIMAL_SEED !== "1") {
    throw new Error(
      "[seed-minimal] Bloqueado: exportá ALLOW_CLF_STAGING_MINIMAL_SEED=1 para confirmar ejecución en staging."
    );
  }

  if (process.env.VERCEL_ENV === "production") {
    throw new Error("[seed-minimal] Bloqueado: VERCEL_ENV=production.");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("[seed-minimal] DATABASE_URL no está definida.");
  }

  const host = databaseHostname(databaseUrl);
  if (!host) {
    throw new Error("[seed-minimal] No se pudo parsear el host de DATABASE_URL.");
  }

  for (const pattern of PRODUCTION_HOST_PATTERNS) {
    if (pattern.test(host) || pattern.test(databaseUrl)) {
      throw new Error(
        `[seed-minimal] DATABASE_URL parece apuntar a producción (${host}). Abortando.`
      );
    }
  }

  console.info(`[seed-minimal] Target DB host: ${host}`);
}

async function ensureAppConfig() {
  return prisma.appConfig.upsert({
    where: { id: 1 },
    update: {
      minDigitalPhotoPrice: DIGITAL_PRICE_CENTS,
      platformCommissionPercent: 10,
      maintenanceMode: false,
    },
    create: {
      id: 1,
      minDigitalPhotoPrice: DIGITAL_PRICE_CENTS,
      platformCommissionPercent: 10,
      maintenanceMode: false,
    },
  });
}

async function ensureUsers(passwordHash: string) {
  const photographer = await upsertStagingUser({
    email: PHOTOGRAPHER_EMAIL,
    passwordHash,
    role: Role.PHOTOGRAPHER,
    name: "Fotógrafo Staging CLF",
    defaultDigitalPhotoPrice: DIGITAL_PRICE_CENTS,
    publicPageHandler: "staging-clf-fotografo",
  });

  const admin = await upsertStagingUser({
    email: ADMIN_EMAIL,
    passwordHash,
    role: Role.ADMIN,
    name: "Admin Staging CLF",
    defaultDigitalPhotoPrice: DIGITAL_PRICE_CENTS,
    publicPageHandler: "staging-clf-admin",
  });

  await prisma.photographerSalesSettings.upsert({
    where: { userId: photographer.id },
    update: {
      digitalEnabled: true,
      printsEnabled: false,
      capabilities: ["digital"],
    },
    create: {
      userId: photographer.id,
      digitalEnabled: true,
      printsEnabled: false,
      capabilities: ["digital"],
    },
  });

  return { photographer, admin };
}

async function ensureAlbum(photographerId: number) {
  const eventDate = new Date();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  const album = await upsertStagingAlbum({
    userId: photographerId,
    publicSlug: ALBUM_PUBLIC_SLUG,
    title: "Álbum demo staging CLF",
    location: "Buenos Aires",
    digitalPhotoPriceCents: DIGITAL_PRICE_CENTS,
    termsVersion: TERMS_VERSION,
    eventDate,
    expiresAt,
  });

  const photoIds: number[] = [];

  for (const photoDef of PLACEHOLDER_PHOTOS) {
    const originalKey = `${SEED_MARKER}/photo-${photoDef.suffix}.jpg`;

    const existingId = await findStagingPhotoId(album.id, originalKey);
    const photoId =
      existingId ??
      (await createStagingPhoto({
        albumId: album.id,
        userId: photographerId,
        previewUrl: photoDef.previewUrl,
        originalKey,
      }));

    photoIds.push(photoId);
  }

  if (photoIds[0] != null) {
    await setAlbumCoverPhotoId(album.id, photoIds[0]);
  }

  return { album, photoCount: photoIds.length };
}

async function ensureBlogPost(skipBlog: boolean) {
  if (skipBlog) {
    console.info("[seed-minimal] Blog: omitido (CLF_STAGING_SEED_SKIP_BLOG=1).");
    return null;
  }

  const category = await prisma.blogCategory.upsert({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: BLOG_CATEGORY_SLUG } },
    update: {
      name: "Staging CLF",
      description: "Categoría de prueba para preview staging.",
      sortOrder: 99,
      isFeatured: false,
    },
    create: {
      platform: CLF_CONTENT_PLATFORM,
      name: "Staging CLF",
      slug: BLOG_CATEGORY_SLUG,
      description: "Categoría de prueba para preview staging.",
      sortOrder: 99,
      isFeatured: false,
    },
    select: { id: true },
  });

  const author = await prisma.blogAuthor.upsert({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: BLOG_AUTHOR_SLUG } },
    update: {
      name: "Equipo Staging CLF",
      role: "Preview",
      bio: "Autor de prueba para staging.",
      isActive: true,
    },
    create: {
      platform: CLF_CONTENT_PLATFORM,
      name: "Equipo Staging CLF",
      slug: BLOG_AUTHOR_SLUG,
      role: "Preview",
      bio: "Autor de prueba para staging.",
      isActive: true,
    },
    select: { id: true },
  });

  const now = new Date();
  const title = "Bienvenida al preview staging de ComprameLaFoto";
  const excerpt = "Post de control para validar listado y detalle del blog en staging.";
  const contentHtml =
    "<p>Este artículo fue creado por <code>seed-minimal</code> para pruebas manuales en staging.</p>";
  const contentJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Artículo de prueba staging ComprameLaFoto." }],
      },
    ],
  };

  const post = await prisma.blogPost.upsert({
    where: { platform_slug: { platform: CLF_CONTENT_PLATFORM, slug: BLOG_POST_SLUG } },
    update: {
      title,
      excerpt,
      contentHtml,
      contentJson,
      status: BlogPostStatus.PUBLISHED,
      publishedAt: now,
      readingTimeMin: 1,
      isFeatured: false,
      noIndex: true,
      categoryId: category.id,
      authorId: author.id,
    },
    create: {
      platform: CLF_CONTENT_PLATFORM,
      title,
      slug: BLOG_POST_SLUG,
      excerpt,
      contentHtml,
      contentJson,
      status: BlogPostStatus.PUBLISHED,
      publishedAt: now,
      readingTimeMin: 1,
      isFeatured: false,
      noIndex: true,
      categoryId: category.id,
      authorId: author.id,
    },
    select: { id: true, slug: true },
  });

  return post;
}

function printCredentials(password: string, albumSlug: string, blogSlug: string | null) {
  const previewBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "(configurá NEXT_PUBLIC_APP_URL para URLs de preview)";

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  Credenciales staging (solo terminal local — no commitear)");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  Fotógrafo:  ${PHOTOGRAPHER_EMAIL}`);
  console.log(`  Admin:      ${ADMIN_EMAIL}`);
  console.log(`  Password:   ${password}`);
  console.log("──────────────────────────────────────────────────────────");
  console.log(`  Galería:    ${previewBase}/a/${albumSlug}`);
  console.log(`  Home API:   ${previewBase}/api/public/albums`);
  if (blogSlug) {
    console.log(`  Blog post:  ${previewBase}/blog/${blogSlug}`);
  }
  console.log("══════════════════════════════════════════════════════════\n");
}

async function main() {
  assertSafeStagingSeed();

  const password = resolveStagingPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const skipBlog =
    process.env.CLF_STAGING_SEED_SKIP_BLOG === "1" ||
    process.env.CLF_STAGING_SEED_SKIP_BLOG === "true";

  console.info("[seed-minimal] Iniciando seed mínimo staging…");

  await ensureAppConfig();
  const { photographer, admin } = await ensureUsers(passwordHash);
  const { album, photoCount } = await ensureAlbum(photographer.id);
  const blogPost = await ensureBlogPost(skipBlog);

  console.info("[seed-minimal] Listo.");
  console.info(`  photographerId=${photographer.id} adminId=${admin.id}`);
  console.info(`  albumId=${album.id} slug=${album.publicSlug} photos=${photoCount}`);
  if (blogPost) {
    console.info(`  blogPostId=${blogPost.id} slug=${blogPost.slug}`);
  }

  if (process.env.CLF_STAGING_SEED_PRINT_CREDENTIALS === "1") {
    printCredentials(password, album.publicSlug, blogPost?.slug ?? null);
  }
}

main()
  .catch((error) => {
    console.error("[seed-minimal] Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
