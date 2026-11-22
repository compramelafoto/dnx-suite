import { buildPublishRequestInput, renderSocialPiece } from "@repo/social-pieces";
import type { MentionCandidate } from "@repo/social-publisher";
import { Prisma, prisma } from "@repo/db";
import { getPublicUrl, uploadToR2 } from "@/lib/r2-client";
import { albumPublicUrl, PLATFORM_HANDLE } from "./build-album-pieces";
import {
  albumConsentKey,
  getAlbumSocialConsent,
  normalizeConsentHandle,
  normalizeExtraHandles,
  saveAlbumSocialConsent,
} from "./album-social-consent";
import {
  artDateKey,
  decideAlbumStory,
  MIN_ALBUM_PHOTOS_FOR_STORY,
  nextFreeStorySlots,
  pickStoryPhotos,
  storyAlbumTitle,
  storyCredit,
  type AlbumStorySkipReason,
} from "./album-stories-plan";
import {
  pickStoryCollage,
  readStoryBrandResource,
  STORY_COLLAGE_MAX_PHOTOS,
  type StoryCollage,
} from "./album-story-collages";
import { logSocialRequest, resolveClfInstagramAccount } from "./prisma-store";
import { carasValidas, fotosConCarasBuenas, type CajaDeCara } from "./story-photo-crop";
import { prepararFotosDelCollage } from "./story-photo-prepare";

/**
 * Historias diarias de álbumes en la cuenta de Instagram de CompraMeLaFoto.
 *
 * Una vez por día (cron `social-album-stories`) se buscan los álbumes subidos en los
 * últimos días, se arma un collage por álbum, se sube a R2 y se deja la solicitud en
 * `SCHEDULED` con su horario. El worker de `social-publish` la publica cuando llega la
 * hora; hasta entonces el admin puede sacarla desde `/admin/social`.
 *
 * Las reglas (qué álbum entra, qué fotos, qué horario) están en `album-stories-plan.ts`.
 */

export const ALBUM_STORY_ENTITY_TYPE = "ALBUM_STORY";
const APPLICATION = "COMPRAMELAFOTO";
const TIMEZONE = "America/Argentina/Buenos_Aires";

/** Ventana de búsqueda: álbumes creados hace entre 6 horas y 3 días. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
/** Se deja pasar un rato desde la creación para que terminen de subir las fotos. */
const SETTLE_MS = 6 * 60 * 60 * 1000;
/** Tope por corrida: cada collage descarga fotos y renderiza, y la función tiene tiempo limitado. */
const MAX_PER_RUN = 20;

export function albumStoryKey(albumId: number): string {
  return `clf:album-story:${albumId}`;
}

/** Estados que ocupan un horario en la agenda del día. */
const OCCUPYING: Prisma.EnumDnxSocialPublishStatusFilter["in"] = [
  "SCHEDULED",
  "APPROVED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
];

// ---------------------------------------------------------------------------
// Permiso por álbum (activado por defecto)
// ---------------------------------------------------------------------------

export type AlbumStoryConsentView = {
  /** Si la cuenta de Instagram de CLF no está conectada, la opción no se muestra. */
  available: boolean;
  enabled: boolean;
  /** Cuentas extra a etiquetar (organizador, empresas), sin @. */
  extraHandles: string[];
  /** El @ del fotógrafo según su perfil: siempre se etiqueta, no hace falta cargarlo. */
  photographerHandle: string | null;
  /** Lo que se descartó en el último guardado por no ser un usuario válido. */
  invalid?: string[];
};

async function handleDelFotografo(albumId: number): Promise<string | null> {
  const a = await prisma.album.findUnique({ where: { id: albumId }, select: { user: { select: { instagram: true } } } });
  return normalizeConsentHandle(a?.user.instagram ?? null);
}

export async function getAlbumStoryConsent(albumId: number): Promise<AlbumStoryConsentView> {
  const [account, consent, photographerHandle] = await Promise.all([
    resolveClfInstagramAccount(),
    getAlbumSocialConsent(albumId),
    handleDelFotografo(albumId),
  ]);
  return {
    available: Boolean(account),
    enabled: consent ? consent.consentGiven : true,
    extraHandles: consent?.extraHandles ?? [],
    photographerHandle,
  };
}

export async function setAlbumStoryConsent(input: {
  albumId: number;
  enabled: boolean;
  /** Sin valor, se conservan las que ya estaban. */
  extraHandles?: unknown;
  userId: number;
}): Promise<AlbumStoryConsentView> {
  const [account, previo, photographerHandle] = await Promise.all([
    resolveClfInstagramAccount(),
    getAlbumSocialConsent(input.albumId),
    handleDelFotografo(input.albumId),
  ]);
  if (!account) return { available: false, enabled: input.enabled, extraHandles: [], photographerHandle };
  const extras =
    input.extraHandles === undefined
      ? { handles: previo?.extraHandles ?? [], invalid: [] }
      : normalizeExtraHandles(input.extraHandles, [photographerHandle]);
  await saveAlbumSocialConsent({
    albumId: input.albumId,
    socialAccountId: account.id,
    consentGiven: input.enabled,
    selectedPhotoIds: previo?.selectedPhotoIds ?? [],
    photographerHandle: previo?.photographerHandle ?? null,
    extraHandles: extras.handles,
    userId: input.userId,
  });
  // Si el fotógrafo apaga el permiso con la historia ya en cola, se saca de la cola.
  if (!input.enabled) {
    await prisma.dnxSocialPublishRequest.updateMany({
      where: { idempotencyKey: albumStoryKey(input.albumId), status: "SCHEDULED" },
      data: { status: "CANCELLED", rejectionReason: "El fotógrafo desactivó la difusión" },
    });
  }
  return {
    available: true,
    enabled: input.enabled,
    extraHandles: extras.handles,
    photographerHandle,
    invalid: extras.invalid,
  };
}

// ---------------------------------------------------------------------------
// Generación diaria
// ---------------------------------------------------------------------------

export type DailyStoriesSummary = {
  ok: boolean;
  reason?: "NO_ACCOUNT";
  candidates: number;
  scheduled: Array<{ albumId: number; scheduleAt: string; collage: string }>;
  skipped: Partial<Record<AlbumStorySkipReason | "QUEUE_FULL" | "NO_PHOTOS", number>>;
  failed: Array<{ albumId: number; error: string }>;
};

export async function generateDailyAlbumStories(now: Date = new Date()): Promise<DailyStoriesSummary> {
  const summary: DailyStoriesSummary = { ok: true, candidates: 0, scheduled: [], skipped: {}, failed: [] };
  const skip = (r: keyof DailyStoriesSummary["skipped"]) => {
    summary.skipped[r] = (summary.skipped[r] ?? 0) + 1;
  };

  const account = await resolveClfInstagramAccount();
  if (!account) return { ...summary, ok: false, reason: "NO_ACCOUNT" };

  const albums = await prisma.album.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: new Date(now.getTime() - SETTLE_MS) },
      deletedAt: null,
      isPublic: true,
      isHidden: false,
      hiddenPhotosEnabled: false,
      isTest: false,
      schoolId: null,
    },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      isPublic: true,
      isHidden: true,
      hiddenPhotosEnabled: true,
      isTest: true,
      schoolId: true,
      deletedAt: true,
      createdAt: true,
      user: { select: { name: true, instagram: true } },
      _count: { select: { photos: { where: { isRemoved: false, previewWatermarkedKey: { not: null } } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  summary.candidates = albums.length;
  if (albums.length === 0) return summary;

  const ids = albums.map((a) => a.id);
  const [generados, permisos] = await Promise.all([
    prisma.dnxSocialPublishRequest.findMany({
      where: { idempotencyKey: { in: ids.map(albumStoryKey) } },
      select: { entityId: true },
    }),
    prisma.dnxSocialPublishRequest.findMany({
      where: { idempotencyKey: { in: ids.map(albumConsentKey) } },
      select: { entityId: true, metadata: true },
    }),
  ]);
  const yaGenerados = new Set(generados.map((g) => Number(g.entityId)));
  const consentimiento = new Map(
    permisos.map((p) => [Number(p.entityId), (p.metadata as { consentGiven?: unknown } | null)?.consentGiven === true]),
  );

  const elegibles = albums.filter((a) => {
    const d = decideAlbumStory({
      isPublic: a.isPublic,
      isHidden: a.isHidden,
      hiddenPhotosEnabled: a.hiddenPhotosEnabled,
      isTest: a.isTest,
      schoolId: a.schoolId,
      deletedAt: a.deletedAt,
      photoCount: a._count.photos,
      consentGiven: consentimiento.has(a.id) ? consentimiento.get(a.id)! : null,
      alreadyGenerated: yaGenerados.has(a.id),
    });
    if (!d.eligible) skip(d.reason);
    return d.eligible;
  });
  if (elegibles.length === 0) return summary;

  // Agenda: lo que ya ocupa horario desde hoy en adelante.
  const inicioHoyArt = new Date(`${artDateKey(now)}T00:00:00-03:00`);
  const ocupados = await prisma.dnxSocialPublishRequest.findMany({
    where: {
      application: APPLICATION,
      entityType: ALBUM_STORY_ENTITY_TYPE,
      status: { in: OCCUPYING },
      scheduleAt: { gte: inicioHoyArt },
    },
    select: { scheduleAt: true },
  });
  const slots = nextFreeStorySlots(
    ocupados.map((o) => o.scheduleAt!).filter(Boolean),
    now,
    Math.min(elegibles.length, MAX_PER_RUN),
  );
  for (let i = slots.length; i < elegibles.length; i++) skip("QUEUE_FULL");

  let ordinal = await prisma.dnxSocialPublishRequest.count({
    where: { application: APPLICATION, entityType: ALBUM_STORY_ENTITY_TYPE },
  });

  for (let i = 0; i < slots.length; i++) {
    const album = elegibles[i]!;
    const scheduleAt = slots[i]!;
    try {
      const collage = pickStoryCollage(ordinal);
      const armada = await renderAlbumStory(album, collage);
      if (!armada) {
        skip("NO_PHOTOS");
        continue;
      }
      const { bytes: imagenBytes, elegidas, handle, permiso } = armada;
      const key = `social/clf/historias/${album.id}-${Date.now()}.jpg`;
      await uploadToR2(Buffer.from(imagenBytes), key, "image/jpeg");
      const publicUrl = getPublicUrl(key);

      const menciones: MentionCandidate[] = [
        ...(handle ? [{ handle, priority: 1, role: "PHOTOGRAPHER" }] : []),
        // Las cuentas que sumó el fotógrafo (organizador, empresas), en su orden.
        ...normalizeExtraHandles(permiso?.extraHandles ?? [], [handle]).handles.map((h, n) => ({
          handle: h,
          priority: 2 + n * 0.1,
          role: "TAGGED",
        })),
        { handle: PLATFORM_HANDLE, priority: 100, role: "PLATFORM" },
      ];
      const input = buildPublishRequestInput(
        {
          application: APPLICATION,
          entityType: ALBUM_STORY_ENTITY_TYPE,
          entityId: String(album.id),
          pieceId: collage.id,
          format: "STORY",
          caption: "",
          mentionCandidates: menciones,
          socialAccountId: account.id,
          idempotencyKey: albumStoryKey(album.id),
          approvalRequired: false,
          extraMetadata: {
            albumId: album.id,
            albumTitle: album.title,
            albumSlug: album.publicSlug,
            photographerHandle: handle,
            photographerName: album.user.name,
            collage: collage.id,
            photoIds: elegidas,
          },
        },
        [publicUrl],
      );

      const creada = await prisma.dnxSocialPublishRequest.create({
        data: {
          application: input.application,
          entityType: input.entityType,
          entityId: input.entityId,
          templateRef: input.templateRef ?? null,
          caption: input.caption,
          hashtags: input.hashtags ?? [],
          mentions: input.mentions ?? [],
          assets: input.assets as unknown as Prisma.InputJsonValue,
          socialAccountId: account.id,
          platform: "INSTAGRAM",
          status: "SCHEDULED",
          approvalRequired: false,
          scheduleAt,
          timezone: TIMEZONE,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });
      await logSocialRequest(creada.id, "SCHEDULED", null, { scheduleAt: scheduleAt.toISOString(), auto: true });
      summary.scheduled.push({ albumId: album.id, scheduleAt: scheduleAt.toISOString(), collage: collage.id });
      ordinal++;
    } catch (error) {
      // Un álbum que falla no frena a los demás.
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[social] historia del álbum ${album.id} no se pudo armar: ${msg}`);
      summary.failed.push({ albumId: album.id, error: msg.slice(0, 200) });
    }
  }
  return summary;
}

type AlbumParaHistoria = {
  id: number;
  title: string;
  publicSlug: string;
  user: { name: string | null; instagram: string | null };
};

/**
 * Arma la imagen de la historia de un álbum con un modelo dado: elige las fotos (las que
 * tienen caras de buen tamaño primero), las encuadra con las caras adentro y renderiza.
 * No sube ni guarda nada: lo usan el cron (que después sube y agenda) y la vista previa
 * del panel, así lo que se ve en la vista previa es exactamente lo que sale.
 *
 * Devuelve `null` si el álbum no tiene fotos suficientes con marca de agua.
 */
export async function renderAlbumStory(album: AlbumParaHistoria, collage: StoryCollage) {
  const fotos = await prisma.photo.findMany({
    where: { albumId: album.id, isRemoved: false, previewWatermarkedKey: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, previewWatermarkedKey: true },
  });
  if (fotos.length < MIN_ALBUM_PHOTOS_FOR_STORY) return null;
  const permiso = await getAlbumSocialConsent(album.id);
  const preferidas = permiso?.selectedPhotoIds ?? [];
  const cantidad = Math.min(collage.fotos, STORY_COLLAGE_MAX_PHOTOS);

  // Caras detectadas (Rekognition) de todo el álbum: sirven para elegir fotos donde la
  // gente se ve y para encuadrar sin cortar cabezas.
  const detecciones = await prisma.faceDetection.findMany({
    where: { photo: { albumId: album.id, isRemoved: false } },
    select: { photoId: true, bbox: true },
  });
  const carasPorFoto = new Map<number, CajaDeCara[]>();
  for (const d of detecciones) {
    const [caja] = carasValidas([d.bbox]);
    if (caja) carasPorFoto.set(d.photoId, [...(carasPorFoto.get(d.photoId) ?? []), caja]);
  }
  const todas = fotos.map((f) => f.id);
  const conCaras = fotosConCarasBuenas(todas, carasPorFoto);
  const elegidas = pickStoryPhotos(conCaras.length >= cantidad ? conCaras : todas, cantidad, preferidas);
  const urlPorId = new Map(fotos.map((f) => [f.id, getPublicUrl(f.previewWatermarkedKey!)]));
  const handle = normalizeConsentHandle(album.user.instagram);

  const bajadas: Array<{ bytes: Uint8Array; caras: CajaDeCara[] }> = [];
  for (const id of elegidas) {
    const bytes = await leerFoto(urlPorId.get(id)!);
    if (!bytes) throw new Error(`No se pudo bajar la foto ${id}`);
    bajadas.push({ bytes, caras: carasPorFoto.get(id) ?? [] });
  }
  const encuadradas = await prepararFotosDelCollage(collage, bajadas);

  const pieza = await renderSocialPiece({
    pieceId: collage.id,
    format: "STORY",
    document: collage.document,
    contract: collage.contract,
    values: {
      nombreAlbum: storyAlbumTitle(album.title),
      creditoFotografo: storyCredit(handle, album.user.name),
      urlAlbum: albumPublicUrl(album.publicSlug),
      ...encuadradas.values,
    },
    resources: { read: async (ref: string) => encuadradas.slots.get(ref) ?? leerFoto(ref) },
    dpi: 96,
  });
  const imagen = pieza.images[0];
  if (!imagen) throw new Error("El render no devolvió imagen");
  return { bytes: imagen.bytes, elegidas, handle, permiso };
}

// ---------------------------------------------------------------------------
// Vista previa (panel): ver cómo saldría, sin guardar ni publicar
// ---------------------------------------------------------------------------

export type PreviewCandidate = {
  albumId: number;
  title: string;
  createdAt: string;
  photoCount: number;
  photographer: string;
  eligible: boolean;
  reason: AlbumStorySkipReason | null;
};

/**
 * Álbumes públicos recientes de más de 50 fotos, con si entrarían o no y por qué. Para la
 * vista previa del panel: funciona aunque la cuenta de Instagram no esté conectada.
 */
export async function listPreviewCandidates(now: Date = new Date(), dias = 7): Promise<PreviewCandidate[]> {
  const albums = await prisma.album.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - dias * 24 * 3600_000) },
      deletedAt: null,
      isTest: false,
      isPublic: true,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      isPublic: true,
      isHidden: true,
      hiddenPhotosEnabled: true,
      isTest: true,
      schoolId: true,
      deletedAt: true,
      user: { select: { name: true, instagram: true } },
      _count: { select: { photos: { where: { isRemoved: false, previewWatermarkedKey: { not: null } } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const grandes = albums.filter((a) => a._count.photos >= MIN_ALBUM_PHOTOS_FOR_STORY);
  const permisos = await prisma.dnxSocialPublishRequest.findMany({
    where: { idempotencyKey: { in: grandes.map((a) => albumConsentKey(a.id)) } },
    select: { entityId: true, metadata: true },
  });
  const consentimiento = new Map(
    permisos.map((p) => [Number(p.entityId), (p.metadata as { consentGiven?: unknown } | null)?.consentGiven === true]),
  );
  return grandes.map((a) => {
    const d = decideAlbumStory({
      isPublic: a.isPublic,
      isHidden: a.isHidden,
      hiddenPhotosEnabled: a.hiddenPhotosEnabled,
      isTest: a.isTest,
      schoolId: a.schoolId,
      deletedAt: a.deletedAt,
      photoCount: a._count.photos,
      consentGiven: consentimiento.has(a.id) ? consentimiento.get(a.id)! : null,
      alreadyGenerated: false,
    });
    const handle = normalizeConsentHandle(a.user.instagram);
    return {
      albumId: a.id,
      title: a.title,
      createdAt: a.createdAt.toISOString(),
      photoCount: a._count.photos,
      photographer: handle ? `@${handle}` : (a.user.name ?? ""),
      eligible: d.eligible,
      reason: d.eligible ? null : d.reason,
    };
  });
}

/** Renderiza la vista previa de un álbum con el modelo `modelo` (0…19). No guarda nada. */
export async function previewAlbumStory(albumId: number, modelo: number): Promise<Uint8Array | null> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, publicSlug: true, user: { select: { name: true, instagram: true } } },
  });
  if (!album) return null;
  const r = await renderAlbumStory(album, pickStoryCollage(modelo));
  return r?.bytes ?? null;
}

/** El Designer no sabe de red: acá se bajan los bytes de cada foto con marca de agua. */
async function leerFoto(ref: string): Promise<Uint8Array | null> {
  const marca = readStoryBrandResource(ref);
  if (marca) return marca;
  if (!/^https?:\/\//.test(ref)) return null;
  try {
    const r = await fetch(ref, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Panel: cola de la semana y veto
// ---------------------------------------------------------------------------

export type StoryQueueItem = {
  id: string;
  status: string;
  scheduleAt: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  albumId: number | null;
  albumTitle: string;
  albumSlug: string | null;
  photographer: string;
  userTags: string[];
  /** Cuentas que Meta no dejó etiquetar al publicar (privadas o inexistentes). */
  droppedUserTags: string[];
  collage: string | null;
  permalink: string | null;
  lastError: string | null;
};

export async function listStoryQueue(now: Date = new Date()): Promise<StoryQueueItem[]> {
  const desde = new Date(now.getTime() - 2 * 24 * 3600_000);
  const filas = await prisma.dnxSocialPublishRequest.findMany({
    where: {
      application: APPLICATION,
      entityType: ALBUM_STORY_ENTITY_TYPE,
      OR: [{ scheduleAt: { gte: desde } }, { status: { in: ["SCHEDULED", "FAILED", "PUBLISHING"] } }],
    },
    orderBy: { scheduleAt: "asc" },
    take: 200,
  });
  return filas.map((f) => {
    const m = (f.metadata ?? {}) as Record<string, unknown>;
    const assets = Array.isArray(f.assets) ? (f.assets as Array<{ publicUrl?: string }>) : [];
    return {
      id: f.id,
      status: f.status,
      scheduleAt: f.scheduleAt?.toISOString() ?? null,
      publishedAt: f.publishedAt?.toISOString() ?? null,
      imageUrl: assets[0]?.publicUrl ?? null,
      albumId: typeof m.albumId === "number" ? m.albumId : Number(f.entityId) || null,
      albumTitle: typeof m.albumTitle === "string" ? m.albumTitle : `Álbum ${f.entityId}`,
      albumSlug: typeof m.albumSlug === "string" ? m.albumSlug : null,
      photographer:
        typeof m.photographerHandle === "string" && m.photographerHandle
          ? `@${m.photographerHandle}`
          : typeof m.photographerName === "string"
            ? m.photographerName
            : "",
      userTags: Array.isArray(m.userTags) ? (m.userTags as string[]) : [],
      droppedUserTags: Array.isArray(m.droppedUserTags) ? (m.droppedUserTags as string[]) : [],
      collage: typeof m.collage === "string" ? m.collage : null,
      permalink: f.permalink,
      lastError: f.lastErrorMessage,
    };
  });
}

/** Veto: saca una historia de la cola. Solo mientras no salió. */
export async function cancelStory(id: string, actorUserId: number): Promise<boolean> {
  const r = await prisma.dnxSocialPublishRequest.updateMany({
    where: { id, entityType: ALBUM_STORY_ENTITY_TYPE, status: { in: ["SCHEDULED", "FAILED"] } },
    data: { status: "CANCELLED", rejectedAt: new Date(), rejectedByUserId: actorUserId, nextRetryAt: null },
  });
  if (r.count > 0) await logSocialRequest(id, "CANCELLED", actorUserId, { veto: true });
  return r.count > 0;
}

/**
 * Adelanta una historia: la deja vencida para que el worker la tome ya. La ruta del panel
 * llama al worker en el momento; no espera al próximo horario del cron.
 */
export async function publishStoryNow(id: string, actorUserId: number): Promise<boolean> {
  const r = await prisma.dnxSocialPublishRequest.updateMany({
    where: { id, entityType: ALBUM_STORY_ENTITY_TYPE, status: "SCHEDULED" },
    data: { scheduleAt: new Date() },
  });
  if (r.count > 0) await logSocialRequest(id, "RESCHEDULED", actorUserId, { now: true });
  return r.count > 0;
}

/**
 * Última verificación antes de publicar: entre que se agendó y que llega la hora, el
 * fotógrafo pudo volver privado el álbum, protegerlo con selfie, borrarlo o apagar la
 * difusión. Si pasó cualquiera de esas cosas, la historia no sale.
 */
export async function isAlbumStillPublishable(albumId: number): Promise<boolean> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { isPublic: true, isHidden: true, hiddenPhotosEnabled: true, isTest: true, schoolId: true, deletedAt: true },
  });
  if (!album) return false;
  const consent = await getAlbumSocialConsent(albumId);
  const d = decideAlbumStory({
    ...album,
    photoCount: MIN_ALBUM_PHOTOS_FOR_STORY,
    consentGiven: consent ? consent.consentGiven : null,
    alreadyGenerated: false,
  });
  return d.eligible;
}

export async function getClfInstagramStatus(): Promise<{
  connected: boolean;
  username: string | null;
  expiresAt: string | null;
  live: boolean;
}> {
  const account = await resolveClfInstagramAccount();
  return {
    connected: Boolean(account),
    username: account?.username ?? null,
    expiresAt: account?.expiresAt?.toISOString() ?? null,
    live: process.env.DNX_SOCIAL_PUBLISHER_LIVE === "true",
  };
}
