import sharp from "sharp";
import { buildPublishRequestInput, renderSocialPiece } from "@repo/social-pieces";
import type { MentionCandidate } from "@repo/social-publisher";
import { Prisma, prisma } from "@repo/db";
import { getPublicUrl, uploadToR2 } from "@/lib/r2-client";
import { PLATFORM_HANDLE } from "./build-album-pieces";
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
  fraseDeHistoria,
  MIN_ALBUM_PHOTOS_FOR_STORY,
  pickStoryPhotos,
  planAlbumStories,
  repartirFotos,
  STORIES_PER_ALBUM,
  storyAlbumTitle,
  storyCredit,
  storyShortUrl,
  type AlbumStorySkipReason,
} from "./album-stories-plan";
import {
  elegirCollageConFotos,
  elegirCollages,
  readStoryBrandResource,
  STORY_COLLAGE_MAX_PHOTOS,
  type StoryCollage,
} from "./album-story-collages";
import { logSocialRequest, resolveClfInstagramAccount } from "./prisma-store";
import { carasValidas, fotosConCarasBuenas, type CajaDeCara } from "./story-photo-crop";
import { prepararFotosDelCollage } from "./story-photo-prepare";
import { WELCOME_STORY_ENTITY_TYPE } from "./welcome-stories";

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
/** Historias que comparten agenda, tope diario, panel y veto: álbumes y bienvenidas. */
const STORY_ENTITY_TYPES = [ALBUM_STORY_ENTITY_TYPE, WELCOME_STORY_ENTITY_TYPE];
const APPLICATION = "COMPRAMELAFOTO";
const TIMEZONE = "America/Argentina/Buenos_Aires";

/** Ventana de búsqueda: álbumes creados hace entre 6 horas y 3 días. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
/** Se deja pasar un rato desde la creación para que terminen de subir las fotos. */
const SETTLE_MS = 6 * 60 * 60 * 1000;
/**
 * Tope de álbumes por corrida (cada uno son 3 collages): cada collage baja fotos y
 * renderiza, y la función tiene tiempo limitado. El cron corre cuatro veces por día
 * (08, 09, 12 y 15 h): hasta 20 álbumes y 60 historias por día. Lo que no entra queda
 * para la corrida siguiente.
 */
const MAX_ALBUMS_PER_RUN = 5;

/** Clave idempotente de la historia `n` (1…3) de un álbum. */
export function albumStoryKey(albumId: number, n: number): string {
  return `clf:album-story:${albumId}:${n}`;
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
      where: { entityType: ALBUM_STORY_ENTITY_TYPE, entityId: String(input.albumId), status: "SCHEDULED" },
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
  scheduled: Array<{ albumId: number; story: number; scheduleAt: string; collage: string }>;
  skipped: Partial<Record<AlbumStorySkipReason | "QUEUE_FULL" | "NO_PHOTOS", number>>;
  failed: Array<{ albumId: number; error: string }>;
};

/**
 * `albumIds`: armar las historias de esos álbumes aunque no sean recientes (el admin los suma
 * a mano desde el panel). Valen las mismas reglas: público, más de 50 fotos, sin selfie, no
 * escolar, con permiso y una sola vez por álbum.
 */
export async function generateDailyAlbumStories(
  now: Date = new Date(),
  opciones: { albumIds?: number[] } = {},
): Promise<DailyStoriesSummary> {
  const summary: DailyStoriesSummary = { ok: true, candidates: 0, scheduled: [], skipped: {}, failed: [] };
  const skip = (r: keyof DailyStoriesSummary["skipped"]) => {
    summary.skipped[r] = (summary.skipped[r] ?? 0) + 1;
  };

  const account = await resolveClfInstagramAccount();
  if (!account) return { ...summary, ok: false, reason: "NO_ACCOUNT" };

  const albums = await prisma.album.findMany({
    where: {
      // Elegidos a mano: se traen igual y `decideAlbumStory` dice por qué no entran.
      ...(opciones.albumIds?.length
        ? { id: { in: opciones.albumIds } }
        : {
            createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: new Date(now.getTime() - SETTLE_MS) },
            deletedAt: null,
            isPublic: true,
            isHidden: false,
            hiddenPhotosEnabled: false,
            isTest: false,
            schoolId: null,
          }),
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
      _count: { select: { photos: { where: { isRemoved: false } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  summary.candidates = albums.length;
  if (albums.length === 0) return summary;

  const ids = albums.map((a) => a.id);
  const [generados, permisos] = await Promise.all([
    prisma.dnxSocialPublishRequest.findMany({
      where: { entityType: ALBUM_STORY_ENTITY_TYPE, entityId: { in: ids.map(String) } },
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
      entityType: { in: STORY_ENTITY_TYPES },
      status: { in: OCCUPYING },
      scheduleAt: { gte: inicioHoyArt },
    },
    select: { scheduleAt: true },
  });
  const tanda = elegibles.slice(0, MAX_ALBUMS_PER_RUN);
  // Lo que no entra en esta corrida queda para mañana: sigue dentro de la ventana de 3 días.
  const plan = planAlbumStories(
    ocupados.map((o) => o.scheduleAt!).filter(Boolean),
    now,
    tanda.length,
  );

  let ordinal = await prisma.dnxSocialPublishRequest.count({
    where: { application: APPLICATION, entityType: ALBUM_STORY_ENTITY_TYPE },
  });

  for (const [a, album] of tanda.entries()) {
    const horarios = plan[a]!;
    if (horarios.length === 0) {
      skip("QUEUE_FULL");
      continue;
    }
    try {
      const armadas = await renderAlbumStories(album, { cantidad: horarios.length, ordinal });
      if (!armadas) {
        skip("NO_PHOTOS");
        continue;
      }
      const { historias, handle, permiso } = armadas;
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

      for (const [k, historia] of historias.entries()) {
        const scheduleAt = horarios[k]!;
        const collage = historia.collage;
        const numero = k + 1;
        const key = `social/clf/historias/${album.id}-${numero}-${Date.now()}.jpg`;
        await uploadToR2(Buffer.from(historia.bytes), key, "image/jpeg");

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
            idempotencyKey: albumStoryKey(album.id, numero),
            approvalRequired: false,
            extraMetadata: {
              albumId: album.id,
              albumTitle: album.title,
              albumSlug: album.publicSlug,
              photographerHandle: handle,
              photographerName: album.user.name,
              collage: collage.id,
              photoIds: historia.photoIds,
              storyNumber: numero,
              storiesTotal: historias.length,
            },
          },
          [getPublicUrl(key)],
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
        summary.scheduled.push({ albumId: album.id, story: numero, scheduleAt: scheduleAt.toISOString(), collage: collage.id });
      }
      ordinal += historias.length;
    } catch (error) {
      // Un álbum que falla no frena a los demás.
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[social] historias del álbum ${album.id} no se pudieron armar: ${msg}`);
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
 * Arma las historias de un álbum, una por modelo de `collages` (hasta 3): elige las fotos
 * (las que tienen caras de buen tamaño primero), las reparte entre las historias sin
 * repetir, las encuadra con las caras adentro y renderiza. No sube ni guarda nada: lo
 * usan el cron (que después sube y agenda) y la vista previa del panel, así lo que se ve
 * en la vista previa es exactamente lo que sale.
 *
 * `soloLa` (índice desde 0) renderiza una sola, para la vista previa. Devuelve `null` si
 * el álbum no tiene fotos suficientes.
 *
 * Las fotos van SIN marca de agua (pedido 2026-11-22): se usan los originales, achicados
 * antes de encuadrar (`prepararFotosDelCollage`). En la historia cada foto ocupa un hueco
 * de como mucho 1080 px, así que una captura no sirve para imprimir.
 */
export async function renderAlbumStories(
  album: AlbumParaHistoria,
  opciones: { cantidad: number; ordinal: number; soloLa?: number },
) {
  const fotos = await prisma.photo.findMany({
    where: { albumId: album.id, isRemoved: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, originalKey: true },
  });
  if (fotos.length < MIN_ALBUM_PHOTOS_FOR_STORY) return null;
  const permiso = await getAlbumSocialConsent(album.id);
  const preferidas = permiso?.selectedPhotoIds ?? [];
  // Se eligen fotos para el peor caso (4 por historia); los modelos se deciden después de
  // ver la forma de las fotos, y las que sobran no se usan.
  const total = opciones.cantidad * STORY_COLLAGE_MAX_PHOTOS;

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
  const elegidas = pickStoryPhotos(conCaras.length >= total ? conCaras : todas, total, preferidas);
  const urlPorId = new Map(fotos.map((f) => [f.id, getPublicUrl(f.originalKey)]));
  const handle = normalizeConsentHandle(album.user.instagram);

  const bajadas = new Map<number, { bytes: Uint8Array; caras: CajaDeCara[]; aspecto: number }>();
  for (const id of elegidas) {
    const bytes = await leerFoto(urlPorId.get(id)!);
    if (!bytes) throw new Error(`No se pudo bajar la foto ${id}`);
    bajadas.set(id, { bytes, caras: carasPorFoto.get(id) ?? [], aspecto: await aspectoDerecho(bytes) });
  }

  // Los modelos se eligen según la forma de las fotos del álbum (la mediana): huecos
  // anchos para fotos horizontales, columnas para verticales.
  const aspectos = [...bajadas.values()].map((b) => b.aspecto).sort((a, b) => a - b);
  const aspectoDelAlbum = aspectos.length ? aspectos[Math.floor(aspectos.length / 2)]! : 1.5;
  const collages = elegirCollages(aspectoDelAlbum, opciones.ordinal, opciones.cantidad);
  const reparto = repartirFotos(elegidas, collages.map((c) => Math.min(c.fotos, STORY_COLLAGE_MAX_PHOTOS)));

  const historias: Array<{ bytes: Uint8Array; photoIds: number[]; collage: StoryCollage }> = [];
  for (const [k, collage] of collages.entries()) {
    if (opciones.soloLa !== undefined && k !== opciones.soloLa) continue;
    const ids = reparto[k]!;
    if (ids.length < collage.fotos) break; // no hay fotos para esta historia: se arma una de menos
    const bytes = await renderUnaHistoria(album, handle, collage, ids.map((id) => bajadas.get(id)!), k + 1);
    historias.push({ bytes, photoIds: ids, collage });
  }
  return { historias, handle, permiso };
}

/** Arma la imagen de UNA historia con sus fotos ya bajadas. No sube ni guarda nada. */
async function renderUnaHistoria(
  album: AlbumParaHistoria,
  handle: string | null,
  collage: StoryCollage,
  fotos: Array<{ bytes: Uint8Array; caras: CajaDeCara[] }>,
  numero: number,
): Promise<Uint8Array> {
  const encuadradas = await prepararFotosDelCollage(collage, fotos);
  const pieza = await renderSocialPiece({
    pieceId: collage.id,
    format: "STORY",
    document: collage.document,
    contract: collage.contract,
    values: {
      frase: fraseDeHistoria(numero, album.id),
      nombreAlbum: storyAlbumTitle(album.title),
      creditoFotografo: storyCredit(handle, album.user.name),
      urlAlbum: storyShortUrl(album.id),
      ...encuadradas.values,
    },
    resources: { read: async (ref: string) => encuadradas.slots.get(ref) ?? leerFoto(ref) },
    dpi: 96,
  });
  const imagen = pieza.images[0];
  if (!imagen) throw new Error("El render no devolvió imagen");
  return imagen.bytes;
}

/**
 * Rehace la imagen de las historias que todavía no salieron (en cola o fallidas) con el
 * diseño actual: mismas fotos, mismo horario, mismas etiquetas. Sirve cuando cambia la
 * plantilla (2026-11-22: se agrandaron las letras) sin perder la agenda.
 */
export async function rehacerHistoriasPendientes(): Promise<{ rehechas: number; fallidas: number }> {
  const pendientes = await prisma.dnxSocialPublishRequest.findMany({
    where: { application: APPLICATION, entityType: ALBUM_STORY_ENTITY_TYPE, status: { in: ["SCHEDULED", "FAILED"] } },
    orderBy: { scheduleAt: "asc" },
    take: 30,
  });
  let rehechas = 0;
  let fallidas = 0;
  for (const [i, r] of pendientes.entries()) {
    try {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      const ids = Array.isArray(m.photoIds) ? (m.photoIds as number[]) : [];
      const numero = typeof m.storyNumber === "number" ? m.storyNumber : 1;
      const album = await prisma.album.findUnique({
        where: { id: Number(r.entityId) },
        select: { id: true, title: true, publicSlug: true, user: { select: { name: true, instagram: true } } },
      });
      if (!album || ids.length === 0) throw new Error("sin álbum o sin fotos");
      const fotos = await prisma.photo.findMany({ where: { id: { in: ids } }, select: { id: true, originalKey: true } });
      const caras = await prisma.faceDetection.findMany({ where: { photoId: { in: ids } }, select: { photoId: true, bbox: true } });
      const bajadas: Array<{ bytes: Uint8Array; caras: CajaDeCara[]; aspecto: number }> = [];
      for (const id of ids) {
        const f = fotos.find((x) => x.id === id);
        if (!f) throw new Error(`falta la foto ${id}`);
        const bytes = await leerFoto(getPublicUrl(f.originalKey));
        if (!bytes) throw new Error(`no se pudo bajar la foto ${id}`);
        bajadas.push({
          bytes,
          caras: carasValidas(caras.filter((c) => c.photoId === id).map((c) => c.bbox)),
          aspecto: await aspectoDerecho(bytes),
        });
      }
      const aspectos = bajadas.map((b) => b.aspecto).sort((a, b) => a - b);
      const collage = elegirCollageConFotos(aspectos[Math.floor(aspectos.length / 2)]!, i, ids.length);
      if (!collage) throw new Error(`no hay modelo de ${ids.length} fotos`);
      const handle = normalizeConsentHandle(album.user.instagram);
      const bytes = await renderUnaHistoria(album, handle, collage, bajadas, numero);
      const key = `social/clf/historias/${album.id}-${numero}-${Date.now()}.jpg`;
      await uploadToR2(Buffer.from(bytes), key, "image/jpeg");
      const assets = (Array.isArray(r.assets) ? r.assets : []) as Array<Record<string, unknown>>;
      await prisma.dnxSocialPublishRequest.update({
        where: { id: r.id },
        data: {
          templateRef: collage.id,
          assets: assets.map((a, j) => (j === 0 ? { ...a, publicUrl: getPublicUrl(key) } : a)) as Prisma.InputJsonValue,
          metadata: { ...m, collage: collage.id } as Prisma.InputJsonValue,
        },
      });
      await logSocialRequest(r.id, "RERENDERED", null, { collage: collage.id });
      rehechas++;
    } catch (e) {
      fallidas++;
      console.error(`[social] no se pudo rehacer la historia ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { rehechas, fallidas };
}

/** Ancho ÷ alto de la foto ya enderezada según EXIF (las cámaras guardan algunas acostadas). */
async function aspectoDerecho(bytes: Uint8Array): Promise<number> {
  const m = await sharp(Buffer.from(bytes), { failOn: "none" }).metadata();
  const w = m.width ?? 3;
  const h = m.height ?? 2;
  return (m.orientation ?? 1) >= 5 ? h / w : w / h;
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
      _count: { select: { photos: { where: { isRemoved: false } } } },
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

/**
 * Vista previa de la historia `historia` (1…3) de un álbum, con el modelo `modelo`
 * (0…19) para la primera; las siguientes usan los modelos que siguen, como en el cron.
 * No guarda nada.
 */
export async function previewAlbumStory(albumId: number, modelo: number, historia = 1): Promise<Uint8Array | null> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, publicSlug: true, user: { select: { name: true, instagram: true } } },
  });
  if (!album) return null;
  const indice = Math.min(Math.max(historia, 1), STORIES_PER_ALBUM) - 1;
  const r = await renderAlbumStories(album, { cantidad: STORIES_PER_ALBUM, ordinal: modelo, soloLa: indice });
  return r?.historias[0]?.bytes ?? null;
}

/** El Designer no sabe de red: acá se bajan los bytes de cada foto (original, sin marca). */
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
  /** «Historia 2 de 3». */
  storyNumber: number | null;
  storiesTotal: number | null;
  collage: string | null;
  permalink: string | null;
  lastError: string | null;
};

export async function listStoryQueue(now: Date = new Date()): Promise<StoryQueueItem[]> {
  const desde = new Date(now.getTime() - 2 * 24 * 3600_000);
  const filas = await prisma.dnxSocialPublishRequest.findMany({
    where: {
      application: APPLICATION,
      entityType: { in: STORY_ENTITY_TYPES },
      OR: [{ scheduleAt: { gte: desde } }, { status: { in: ["SCHEDULED", "FAILED", "PUBLISHING"] } }],
    },
    orderBy: { scheduleAt: "asc" },
    take: 200,
  });
  return filas.map((f) => {
    const m = (f.metadata ?? {}) as Record<string, unknown>;
    const assets = Array.isArray(f.assets) ? (f.assets as Array<{ publicUrl?: string }>) : [];
    const bienvenida = f.entityType === WELCOME_STORY_ENTITY_TYPE;
    return {
      id: f.id,
      status: f.status,
      scheduleAt: f.scheduleAt?.toISOString() ?? null,
      publishedAt: f.publishedAt?.toISOString() ?? null,
      imageUrl: assets[0]?.publicUrl ?? null,
      albumId: bienvenida ? null : typeof m.albumId === "number" ? m.albumId : Number(f.entityId) || null,
      albumTitle: bienvenida
        ? "Bienvenida al fotógrafo"
        : typeof m.albumTitle === "string"
          ? m.albumTitle
          : `Álbum ${f.entityId}`,
      albumSlug: typeof m.albumSlug === "string" ? m.albumSlug : null,
      photographer:
        typeof m.photographerHandle === "string" && m.photographerHandle
          ? `@${m.photographerHandle}`
          : typeof m.photographerName === "string"
            ? m.photographerName
            : "",
      userTags: Array.isArray(m.userTags) ? (m.userTags as string[]) : [],
      droppedUserTags: Array.isArray(m.droppedUserTags) ? (m.droppedUserTags as string[]) : [],
      storyNumber: typeof m.storyNumber === "number" ? m.storyNumber : null,
      storiesTotal: typeof m.storiesTotal === "number" ? m.storiesTotal : null,
      collage: typeof m.collage === "string" ? m.collage : null,
      permalink: f.permalink,
      lastError: f.lastErrorMessage,
    };
  });
}

/** Veto: saca una historia de la cola. Solo mientras no salió. */
export async function cancelStory(id: string, actorUserId: number): Promise<boolean> {
  const r = await prisma.dnxSocialPublishRequest.updateMany({
    where: { id, entityType: { in: STORY_ENTITY_TYPES }, status: { in: ["SCHEDULED", "FAILED"] } },
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
    where: { id, entityType: { in: STORY_ENTITY_TYPES }, status: "SCHEDULED" },
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
