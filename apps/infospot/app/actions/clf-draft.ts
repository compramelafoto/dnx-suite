"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, resolveClfAlbumCommercialAvailability } from "@repo/db";
import {
  canManageInfoSpotSettings,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { buildClfDraftMarkdown, suggestCategorySlug } from "@/lib/clf-draft";
import {
  getClfReadonlyEventForDraft,
  listClfAlbumPhotoCandidates,
  listClfReadonlyCandidates,
  probeClfReadonlyConnection,
} from "@/lib/clf-readonly-queries";
import { getClfReadonlyConnectionInfo } from "@/lib/clf-readonly-db";
import { ensureUniqueSlug } from "@/lib/articles";
import { slugifyTitle } from "@/lib/slug";
import { formatDateEs } from "@/lib/dates";

export type ActionResult =
  | { ok: true; id?: string; message: string; ids?: string[] }
  | { ok: false; error: string };

function assertDirector(
  access: Awaited<ReturnType<typeof requireInfoSpotRedaccionAccess>>,
): ActionResult | null {
  if (!canManageInfoSpotSettings(access.subject)) {
    return { ok: false, error: "Solo el Director puede crear borradores desde eventos CLF." };
  }
  return null;
}

function clfSourceEnvLabel(): string {
  const info = getClfReadonlyConnectionInfo();
  return info.hostMasked
    ? `CLF_READONLY:${info.hostMasked}/${info.databaseName}`
    : "CLF_READONLY:unconfigured";
}

export async function getClfReadonlyStatusAction() {
  return probeClfReadonlyConnection();
}

export async function listClfCandidatesForRedaccionAction() {
  const access = await requireInfoSpotRedaccionAccess();
  const denied = assertDirector(access);
  if (denied) return { ...denied, connection: null, candidates: [] as const };

  const { connection, candidates } = await listClfReadonlyCandidates(50);
  // No exponer emails crudos al cliente más de lo necesario: ya vienen como display name.
  return {
    ok: true as const,
    connection,
    candidates: candidates.map((c) => ({
      eventId: c.eventId,
      nombre: c.nombre,
      fecha: c.fecha,
      ciudad: c.ciudad,
      lugar: c.lugar,
      tipo: c.tipo,
      organizador: c.organizador,
      albumCount: c.albumCount,
      photoCount: c.photoCount,
      photographers: c.photographers,
      topAlbumId: c.topAlbumId,
      topAlbumTitle: c.topAlbumTitle,
      topAlbumPublicUrl: c.topAlbumPublicUrl,
      commercialStatus: c.commercialStatus,
      commercialReason: c.commercialReason,
      priority: c.priority,
      priorityReasons: c.priorityReasons,
      dataQuality: c.dataQuality,
      missing: c.missing,
      suggestedCategorySlug: c.suggestedCategorySlug,
      occurred: c.occurred,
    })),
  };
}

export async function listAlbumPhotosForRedaccionAction(albumId: number) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    return { ok: false as const, error: "Sin permiso", photos: [] };
  }
  const photos = await listClfAlbumPhotoCandidates(albumId, 24);
  // Nunca devolver originalKey; solo preview/thumb.
  return {
    ok: true as const,
    photos: photos.map((p) => ({
      photoId: p.photoId,
      albumId: p.albumId,
      albumTitle: p.albumTitle,
      eventTitle: p.eventTitle,
      photographerName: p.photographerName,
      previewUrl: p.previewUrl,
      canUseAsCover: p.canUseAsCover,
      commercialStatus: p.commercialStatus,
      reason: p.reason,
    })),
  };
}

export async function createDraftFromClfEventAction(eventId: number): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  const denied = assertDirector(access);
  if (denied) return denied;

  const probe = await probeClfReadonlyConnection();
  if (!probe.ok) {
    return {
      ok: false,
      error: probe.error || "CLF_READONLY_DATABASE_URL no disponible o DB vacía",
    };
  }

  const event = await getClfReadonlyEventForDraft(eventId);
  if (!event) return { ok: false, error: "Evento CLF no encontrado o archivado (read-only)." };

  const albumsWithPhotos = event.albums.filter((a) => a._count.photos > 0);
  const topAlbum = [...albumsWithPhotos].sort((a, b) => b._count.photos - a._count.photos)[0];
  const photoCount = albumsWithPhotos.reduce((n, a) => n + a._count.photos, 0);
  const photographers = [
    ...new Map(
      albumsWithPhotos.map((a) => [a.user.email, a.user.name?.trim() || a.user.email]),
    ).values(),
  ];

  if (photoCount === 0) {
    return { ok: false, error: "El evento no tiene fotografías utilizables." };
  }

  let commercialNote = "";
  if (topAlbum) {
    const avail = resolveClfAlbumCommercialAvailability({
      publicSlug: topAlbum.publicSlug,
      isHidden: topAlbum.isHidden,
      isPublic: topAlbum.isPublic,
      deletedAt: topAlbum.deletedAt,
      firstPhotoDate: topAlbum.firstPhotoDate,
      createdAt: topAlbum.createdAt,
      expirationExtensionDays: topAlbum.expirationExtensionDays,
      cleanupStatus: topAlbum.cleanupStatus,
    });
    commercialNote = `\n- **Estado comercial del álbum:** ${avail.status} — ${avail.reason}\n- **URL pública álbum:** ${avail.publicUrl}`;
  }

  const categorySlug = suggestCategorySlug(event.type);
  const category = await prisma.infoSpotCategory.findUnique({
    where: { slug: categorySlug },
    select: { id: true },
  });

  const organizerName = event.creator.name?.trim() || event.creator.email;
  const draft = buildClfDraftMarkdown({
    title: event.title,
    startsAt: event.startsAt,
    city: event.city,
    locationName: event.locationName,
    organizerName,
    photographers,
    albumTitle: topAlbum?.title ?? null,
    photoCount,
  });

  // Ampliar markdown con metadata comercial (factual).
  const content = `${draft.content}${commercialNote ? `\n## Disponibilidad comercial (CLF)\n${commercialNote}\n` : ""}`;

  const baseSlug =
    slugifyTitle(`cobertura-${event.title}`).slice(0, 60) || `cobertura-clf-${event.id}`;
  const slug = await ensureUniqueSlug(baseSlug);

  // Escritura SOLO en DB Info Spot (prisma @repo/db / DATABASE_URL).
  const article = await prisma.infoSpotArticle.create({
    data: {
      title: draft.title,
      slug,
      excerpt: draft.excerpt,
      content,
      categoryId: category?.id ?? null,
      authorId: access.user.id,
      status: "DRAFT",
      contentTag: "REAL",
      eventId: event.id,
      clfAlbumId: topAlbum?.id ?? null,
      eventLinkedByUserId: access.user.id,
      eventLinkedAt: new Date(),
      sourceName: "ComprameLaFoto",
      sourceUrl: topAlbum
        ? resolveClfAlbumCommercialAvailability({
            publicSlug: topAlbum.publicSlug,
            isHidden: topAlbum.isHidden,
            isPublic: topAlbum.isPublic,
            deletedAt: topAlbum.deletedAt,
            firstPhotoDate: topAlbum.firstPhotoDate,
            createdAt: topAlbum.createdAt,
            expirationExtensionDays: topAlbum.expirationExtensionDays,
            cleanupStatus: topAlbum.cleanupStatus,
          }).publicUrl
        : null,
      clfSourceEnv: clfSourceEnvLabel(),
      clfImportedAt: new Date(),
      seoTitle: null,
      seoDescription: null,
      publishedAt: null,
    },
  });

  revalidatePath("/redaccion");
  return {
    ok: true,
    id: article.id,
    message: `Borrador REAL creado desde «${event.title}» (${formatDateEs(event.startsAt)}). No publicado. Escritura solo en Info Spot.`,
  };
}

export async function createDraftFromClfEventAndRedirect(formData: FormData) {
  const raw = String(formData.get("eventId") || "");
  const eventId = Number(raw);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    redirect(`/redaccion/desde-clf?error=${encodeURIComponent("Evento inválido")}`);
  }
  const result = await createDraftFromClfEventAction(eventId);
  if (!result.ok || !result.id) {
    redirect(
      `/redaccion/desde-clf?error=${encodeURIComponent(result.ok ? "Error" : result.error)}`,
    );
  }
  redirect(
    `/redaccion/noticias/${result.id}/editar?ok=${encodeURIComponent(result.message)}`,
  );
}

/** Importa 5–8 borradores de PRIORIDAD_ALTA (nunca publica). Solo escribe en Info Spot. */
export async function importHighPriorityClfDraftsAction(formData: FormData): Promise<void> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    redirect(`/redaccion/desde-clf?error=${encodeURIComponent("Solo Director")}`);
  }

  const max = Math.min(8, Math.max(5, Number(formData.get("max") || 8)));
  const { connection, candidates } = await listClfReadonlyCandidates(50);
  if (!connection.ok) {
    redirect(
      `/redaccion/desde-clf?error=${encodeURIComponent(connection.error || "CLF read-only no disponible")}`,
    );
  }

  const high = candidates.filter((c) => c.priority === "PRIORIDAD_ALTA").slice(0, max);
  if (high.length === 0) {
    redirect(
      `/redaccion/desde-clf?error=${encodeURIComponent("No hay candidatos PRIORIDAD_ALTA")}`,
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const c of high) {
    const existing = await prisma.infoSpotArticle.findFirst({
      where: { eventId: c.eventId, contentTag: "REAL", status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (existing) {
      skipped.push(String(c.eventId));
      continue;
    }
    const result = await createDraftFromClfEventAction(c.eventId);
    if (result.ok && result.id) created.push(result.id);
  }

  revalidatePath("/redaccion");
  redirect(
    `/redaccion/desde-clf?ok=${encodeURIComponent(
      `Importados ${created.length} borradores REAL (omitidos ya existentes: ${skipped.length}). No publicados.`,
    )}`,
  );
}

/** Archiva todo el contenido DEMO (artículos + eventos Info Spot). No borra. No toca CLF. */
export async function archiveAllDemoContentAction(formData: FormData): Promise<void> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    redirect(`/admin/lanzamiento?error=${encodeURIComponent("Solo Director")}`);
  }
  const confirm = String(formData.get("confirm") || "");
  if (confirm !== "ARCHIVAR_DEMO") {
    redirect(
      `/admin/lanzamiento?error=${encodeURIComponent("Confirmación inválida. Escribí ARCHIVAR_DEMO.")}`,
    );
  }

  const [articles, events] = await Promise.all([
    prisma.infoSpotArticle.updateMany({
      where: { contentTag: "DEMO", status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED" },
    }),
    prisma.infoSpotEvent.updateMany({
      where: { contentTag: "DEMO", status: { not: "ARCHIVED" } },
      data: { status: "ARCHIVED" },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/noticias");
  revalidatePath("/eventos");
  revalidatePath("/redaccion");
  revalidatePath("/admin/lanzamiento");
  redirect(
    `/admin/lanzamiento?ok=${encodeURIComponent(
      `DEMO archivado: ${articles.count} artículo(s), ${events.count} evento(s).`,
    )}`,
  );
}

export async function previewArchiveDemoCounts(): Promise<{
  articles: number;
  events: number;
}> {
  const [articles, events] = await Promise.all([
    prisma.infoSpotArticle.count({
      where: { contentTag: "DEMO", status: { not: "ARCHIVED" } },
    }),
    prisma.infoSpotEvent.count({
      where: { contentTag: "DEMO", status: { not: "ARCHIVED" } },
    }),
  ]);
  return { articles, events };
}
