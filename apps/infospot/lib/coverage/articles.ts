/**
 * Crear / vincular artículos desde una cobertura.
 */

import { prisma } from "@repo/db";
import { ensureUniqueSlug } from "../articles";
import { slugifyTitle } from "../slug";
import { buildCoverageSummaryStub } from "./ai-stub";
import { linkArticleToOrigin, normalizeClfExternalIdentity } from "../content-origin";
import { deriveCoverageEditorialStatus } from "./editorial-status";

export async function createArticleFromCoverage(input: {
  coverageId: string;
  authorId: number;
  linkRole?: "PRIMARY" | "FOLLOW_UP" | "GALLERY_ONLY";
}): Promise<{ ok: true; articleId: string; slug: string } | { ok: false; error: string }> {
  const coverage = await prisma.infoSpotCoverage.findUnique({
    where: { id: input.coverageId },
    include: { photographers: true },
  });
  if (!coverage) return { ok: false, error: "Cobertura no encontrada." };

  const photographerNames = coverage.photographers.map((p) => p.displayName);
  const summary = buildCoverageSummaryStub({
    title: coverage.title,
    city: coverage.city,
    eventTitle: coverage.eventTitle,
    photoCount: coverage.photoCount,
    photographerNames,
  });

  const title = coverage.eventTitle
    ? `Cobertura: ${coverage.eventTitle}`
    : `Cobertura: ${coverage.title}`;
  const baseSlug =
    slugifyTitle(`cobertura-${coverage.publicSlug || coverage.title}`).slice(0, 60) ||
    `cobertura-${coverage.clfAlbumId}`;
  const slug = await ensureUniqueSlug(baseSlug);

  const article = await prisma.infoSpotArticle.create({
    data: {
      title,
      slug,
      excerpt: summary.slice(0, 280),
      content: `## Resumen\n\n${summary}\n\n## Notas\n\nBorrador creado desde el Centro Editorial de Coberturas.\n`,
      authorId: input.authorId,
      status: "DRAFT",
      contentTag: "REAL",
      eventId: coverage.clfEventId,
      clfAlbumId: coverage.clfAlbumId,
      eventLinkedByUserId: input.authorId,
      eventLinkedAt: new Date(),
      sourceName: "ComprameLaFoto",
      sourceUrl: coverage.publicUrl,
      clfImportedAt: new Date(),
      clfSourceEnv: "coverage-center",
    },
    select: { id: true, slug: true },
  });

  await prisma.infoSpotCoverageArticle.create({
    data: {
      coverageId: coverage.id,
      articleId: article.id,
      linkRole: input.linkRole ?? "PRIMARY",
      linkedByUserId: input.authorId,
    },
  });

  const albumIdentity = normalizeClfExternalIdentity("ALBUM", coverage.clfAlbumId);
  await linkArticleToOrigin(article.id, {
    sourceType: "COMPRAMELAFOTO",
    externalEntityType: "ALBUM",
    externalId: albumIdentity.externalId,
    externalUrl: coverage.publicUrl,
    direction: "INBOUND",
    operationalPayload: (coverage.operationalSnapshot as Record<string, unknown>) ?? {
      albumId: coverage.clfAlbumId,
      publicSlug: coverage.publicSlug,
    },
  });

  if (coverage.clfEventId) {
    const eventIdentity = normalizeClfExternalIdentity("EVENT", coverage.clfEventId);
    await linkArticleToOrigin(article.id, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "EVENT",
      externalId: eventIdentity.externalId,
      externalUrl: null,
      direction: "INBOUND",
      operationalPayload: { eventId: coverage.clfEventId },
    });
  }

  const links = await prisma.infoSpotCoverageArticle.findMany({
    where: { coverageId: coverage.id },
    include: { article: { select: { status: true } } },
  });

  await prisma.infoSpotCoverage.update({
    where: { id: coverage.id },
    data: {
      discoveryStatus: "LINKED",
      editorialStatus: deriveCoverageEditorialStatus({
        syncStatus: coverage.syncStatus,
        discoveryStatus: "LINKED",
        articles: links.map((l) => ({ status: l.article.status })),
      }),
    },
  });

  return { ok: true, articleId: article.id, slug: article.slug };
}

export async function linkExistingArticleToCoverage(input: {
  coverageId: string;
  articleId: string;
  linkedByUserId: number;
  linkRole?: "PRIMARY" | "FOLLOW_UP" | "GALLERY_ONLY";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [coverage, article] = await Promise.all([
    prisma.infoSpotCoverage.findUnique({ where: { id: input.coverageId } }),
    prisma.infoSpotArticle.findUnique({
      where: { id: input.articleId },
      select: { id: true, status: true, clfAlbumId: true },
    }),
  ]);
  if (!coverage) return { ok: false, error: "Cobertura no encontrada." };
  if (!article) return { ok: false, error: "Artículo no encontrado." };

  await prisma.infoSpotCoverageArticle.upsert({
    where: {
      coverageId_articleId: {
        coverageId: input.coverageId,
        articleId: input.articleId,
      },
    },
    create: {
      coverageId: input.coverageId,
      articleId: input.articleId,
      linkRole: input.linkRole ?? "FOLLOW_UP",
      linkedByUserId: input.linkedByUserId,
    },
    update: {
      linkRole: input.linkRole ?? "FOLLOW_UP",
      linkedByUserId: input.linkedByUserId,
    },
  });

  if (!article.clfAlbumId) {
    await prisma.infoSpotArticle.update({
      where: { id: article.id },
      data: {
        clfAlbumId: coverage.clfAlbumId,
        eventId: coverage.clfEventId ?? undefined,
        eventLinkedAt: new Date(),
        eventLinkedByUserId: input.linkedByUserId,
      },
    });
  }

  const links = await prisma.infoSpotCoverageArticle.findMany({
    where: { coverageId: coverage.id },
    include: { article: { select: { status: true } } },
  });

  await prisma.infoSpotCoverage.update({
    where: { id: coverage.id },
    data: {
      discoveryStatus: "LINKED",
      editorialStatus: deriveCoverageEditorialStatus({
        syncStatus: coverage.syncStatus,
        discoveryStatus: "LINKED",
        articles: links.map((l) => ({ status: l.article.status })),
      }),
    },
  });

  return { ok: true };
}
