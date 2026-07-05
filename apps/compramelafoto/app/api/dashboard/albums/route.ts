import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAlbumPhotosQueuedForHiddenMode } from "@/lib/hidden-album/prepare-hidden-album-photos";
import { requireAuth } from "@/lib/auth";
import { AlbumMode, EventType, OrganizerCommissionAppliesTo, Role } from "@/lib/prisma";
import crypto from "crypto";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";
import { encodeGeohash } from "@/lib/geo";
import { eventPhotographerAlbumVisibilityForEventJoin } from "@/lib/events/event-photographer-album-visibility";
import { decodeCourseSlotKey } from "@/lib/school-roster/course-slot-key";
import { ensureAlbumRosterFromEnrollments } from "@/lib/school-roster/ensure-album-roster-from-enrollments";
import { albumIdsWithAnyVideos } from "@/lib/videos/album-media-type-flags";
import {
  buildAlbumListCoverUrls,
} from "@/lib/album/album-list-cover";
import { loadAlbumListPhotoAggregates } from "@/lib/albums/album-photo-stats";
import { resolveCreateAlbumSaleChannels } from "@/lib/albums/resolve-create-album-sale-channels";
import {
  parseAlbumEventScheduleInput,
  validateAlbumEventSchedule,
} from "@/lib/albums/album-event-datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSelectedCourseKeysFromBody(raw: unknown): { ok: false; error: string } | { ok: true; keys: string[] } {
  if (raw === undefined || raw === null) return { ok: true, keys: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "selectedCourseKeys debe ser un arreglo de textos" };
  }
  const keys: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, error: "Cada clave de curso debe ser texto" };
    }
    const t = item.trim();
    if (!t) continue;
    if (decodeCourseSlotKey(t) === null) {
      return { ok: false, error: "Clave de curso inválida" };
    }
    keys.push(t);
  }
  return { ok: true, keys: [...new Set(keys)] };
}

async function photographerHasActiveProducts(userId: number): Promise<boolean> {
  const prismaAny = prisma as any;
  if (!prismaAny.photographerProduct?.findFirst) {
    return true;
  }
  const product = await prismaAny.photographerProduct.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  });
  return Boolean(product);
}

// GET: Listar álbumes del fotógrafo autenticado
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    let albumsWithCount: Array<Record<string, unknown>>;

    const buildWhere = (includeDeletedAt: boolean) => {
      const base: Record<string, unknown> = {
        OR: [
          { userId: user.id },
          { photos: { some: { userId: user.id } } },
        ],
      };
      if (includeDeletedAt) base.deletedAt = null;
      return base;
    };

    try {
      const albums = await prisma.album.findMany({
        where: buildWhere(true) as any,
        include: {
          coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
          photos: {
            where: { isRemoved: false },
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { id: true, previewUrl: true, originalKey: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const aggregates = await loadAlbumListPhotoAggregates(
        prisma,
        albums.map((a) => a.id),
        user.id
      );

      albumsWithCount = albums.map((album) => {
        const agg = aggregates.get(album.id) ?? {
          photosCount: 0,
          myPhotosCount: 0,
          hasOtherContributors: false,
        };
        const { photos, ...albumRest } = album;
        const fallbackCoverPhoto = photos[0] ?? null;
        return {
          ...albumRest,
          photosCount: agg.photosCount,
          myPhotosCount: agg.myPhotosCount,
          hasOtherContributors: agg.hasOtherContributors,
          isCollaborative: album.userId !== user.id,
          expirationExtensionDays: (album as any).expirationExtensionDays ?? 0,
          ...buildAlbumListCoverUrls({
            id: album.id,
            coverPhotoId: (album as { coverPhotoId?: number | null }).coverPhotoId ?? null,
            coverThumbnailKey: (album as any).coverThumbnailKey,
            coverPhoto: album.coverPhoto,
            fallbackCoverPhoto,
            photosCount: agg.photosCount,
          }),
          showComingSoonMessage: agg.photosCount <= 0,
          firstPhotoDate: (album as any).firstPhotoDate || null,
        };
      });
    } catch (dbErr: any) {
      const msg = String(dbErr?.message ?? dbErr);
      const useFallback =
        msg.includes("coverPhotoId") ||
        msg.includes("coverPhoto") ||
        msg.includes("deletedAt") ||
        msg.includes("does not exist") ||
        msg.includes("Unknown column") ||
        msg.includes("Unknown field") ||
        msg.includes("relation");

      if (!useFallback) throw dbErr;

      try {
        const fallbackWhere = msg.includes("deletedAt") ? { userId: user.id } : { userId: user.id, deletedAt: null };
        const albums = await prisma.album.findMany({
          where: fallbackWhere as any,
          select: {
            id: true,
            title: true,
            location: true,
            eventDate: true,
            publicSlug: true,
            createdAt: true,
            showComingSoonMessage: true,
            userId: true,
            hiddenPhotosEnabled: true,
            hiddenSelfieRetentionDays: true,
            _count: {
              select: {
                photos: { where: { isRemoved: false } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const aggregates = await loadAlbumListPhotoAggregates(
          prisma,
          albums.map((a) => a.id),
          user.id
        );

        albumsWithCount = albums.map((album: any) => {
          const agg = aggregates.get(album.id) ?? {
            photosCount: album._count?.photos ?? 0,
            myPhotosCount: 0,
            hasOtherContributors: false,
          };
          const { _count, ...albumRest } = album;
          return {
            ...albumRest,
            photosCount: agg.photosCount,
            myPhotosCount: agg.myPhotosCount,
            hasOtherContributors: agg.hasOtherContributors,
            isCollaborative: album.userId !== user.id,
            expirationExtensionDays: album.expirationExtensionDays ?? 0,
            coverPhotoUrl: null,
            showComingSoonMessage: album.showComingSoonMessage || false,
            firstPhotoDate: album.firstPhotoDate || null,
          };
        });
      } catch (fallbackErr: any) {
        const fallbackMsg = String(fallbackErr?.message ?? "");
        const useMinimalSelect =
          fallbackMsg.includes("deletedAt") ||
          fallbackMsg.includes("hiddenPhotosEnabled") ||
          fallbackMsg.includes("hiddenSelfieRetentionDays") ||
          fallbackMsg.includes("does not exist");
        if (useMinimalSelect) {
          const albums = await prisma.album.findMany({
            where: { userId: user.id },
            select: {
              id: true,
              title: true,
              location: true,
              eventDate: true,
              publicSlug: true,
              createdAt: true,
              showComingSoonMessage: true,
              userId: true,
              _count: {
                select: {
                  photos: { where: { isRemoved: false } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          });
          albumsWithCount = albums.map((album: any) => {
            const { _count, ...albumRest } = album;
            return {
            ...albumRest,
            photosCount: album._count?.photos ?? 0,
            myPhotosCount: album._count?.photos ?? 0,
            hasOtherContributors: false,
            isCollaborative: false,
            expirationExtensionDays: 0,
            coverPhotoUrl: null,
            showComingSoonMessage: album.showComingSoonMessage || false,
            firstPhotoDate: album.firstPhotoDate || null,
            hiddenPhotosEnabled: false,
            hiddenSelfieRetentionDays: null,
          };
          });
        } else {
          throw fallbackErr;
        }
      }
    }

    const albumIds = albumsWithCount.map((album) => Number(album.id)).filter((id) => id > 0);
    const albumsWithVideos = await albumIdsWithAnyVideos(prisma, albumIds);
    const albumsPayload = albumsWithCount.map((album) => {
      const photosCount = Number(album.photosCount) || 0;
      const id = Number(album.id);
      return {
        ...album,
        hasPhotos: photosCount > 0,
        hasVideos: albumsWithVideos.has(id),
      };
    });

    return NextResponse.json(albumsPayload);
  } catch (err: any) {
    console.error("GET /api/dashboard/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo álbumes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo álbum
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const mpUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mpAccessToken: true },
    });
    if (!mpUser?.mpAccessToken) {
      return NextResponse.json(
        {
          error: "Debés vincular tu cuenta de Mercado Pago para crear álbumes.",
          redirectUrl: "/fotografo/configuracion?tab=laboratorio",
        },
        { status: 403 }
      );
    }

    // Si es LAB_PHOTOGRAPHER, verificar que tenga soyFotografo habilitado
    if (user.role === Role.LAB_PHOTOGRAPHER) {
      const lab = await prisma.lab.findFirst({
        where: { userId: user.id },
        select: { soyFotografo: true },
      });
      if (!lab || !lab.soyFotografo) {
        return NextResponse.json(
          { error: "Debés habilitar la funcionalidad de álbumes en la configuración del laboratorio." },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const {
      title,
      location,
      eventDate,
      eventStartTime,
      eventEndTime,
      albumProfitMarginPercent,
      printPricingSource,
      digitalPhotoPriceCents,
      selectedLabId,
      pickupBy,
      enablePrintedPhotos,
      enableDigitalPhotos,
      includeDigitalWithPrint,
      digitalWithPrintDiscountPercent,
      showComingSoonMessage,
      isPublic,
      hiddenPhotosEnabled,
      hiddenSelfieRetentionDays,
      termsAccepted,
      digitalDiscount5Plus,
      digitalDiscount10Plus,
      digitalDiscount20Plus,
      joinAlbumId,
      eventId: linkEventId,
      mode: bodyMode,
      latitude: bodyLatitude,
      longitude: bodyLongitude,
    } = body;

    // Si se quiere unirse a un álbum existente
    if (joinAlbumId) {
      const albumId = parseInt(String(joinAlbumId));
      if (!isNaN(albumId) && albumId > 0) {
        // Verificar que el álbum existe y es público
        const existingAlbum = await prisma.album.findUnique({
          where: { id: albumId },
          select: {
            id: true,
            title: true,
            isPublic: true,
            isHidden: true,
            userId: true,
            _count: {
              select: {
                photos: { where: { isRemoved: false } },
              },
            },
          },
        });

        if (!existingAlbum) {
          return NextResponse.json(
            { error: "Álbum no encontrado" },
            { status: 404 }
          );
        }

        if (existingAlbum.isHidden || !existingAlbum.isPublic) {
          return NextResponse.json(
            { error: "Este álbum no está disponible para colaboración" },
            { status: 403 }
          );
        }

        if (existingAlbum.userId === user.id) {
          return NextResponse.json(
            { error: "Ya sos el creador de este álbum" },
            { status: 400 }
          );
        }

        // Retornar el álbum existente (el usuario puede empezar a subir fotos)
        return NextResponse.json({
          id: existingAlbum.id,
          title: existingAlbum.title,
          isPublic: existingAlbum.isPublic,
          isHidden: existingAlbum.isHidden,
          userId: existingAlbum.userId,
          photosCount: existingAlbum._count.photos,
          joined: true,
        });
      }
    }

    let linkedEvent: {
      id: number;
      type: EventType;
      latitude: number;
      longitude: number;
      city: string;
      startsAt: Date;
      endsAt: Date | null;
    } | null = null;
    if (linkEventId !== undefined && linkEventId !== null && linkEventId !== "") {
      const eid = parseInt(String(linkEventId), 10);
      if (!Number.isFinite(eid) || eid <= 0) {
        return NextResponse.json({ error: "ID de evento inválido" }, { status: 400 });
      }
      const membership = await prisma.eventMember.findUnique({
        where: { eventId_userId: { eventId: eid, userId: user.id } },
        include: { event: true },
      });
      if (!membership || membership.status !== "ACTIVE" || !membership.event) {
        return NextResponse.json({ error: "No estás inscrito en este evento" }, { status: 403 });
      }
      const ev = membership.event;
      if (ev.archivedAt) {
        return NextResponse.json({ error: "Este evento no está disponible" }, { status: 404 });
      }
      const existingForEvent = await prisma.album.findFirst({
        where: { eventId: eid, userId: user.id, deletedAt: null },
        select: { id: true },
      });
      if (existingForEvent) {
        return NextResponse.json(
          {
            error: "Ya tenés un álbum para este evento.",
            existingAlbumId: existingForEvent.id,
          },
          { status: 409 }
        );
      }
      const now = new Date();
      const ended = ev.endsAt ? ev.endsAt < now : ev.startsAt < now;
      if (!ev.uploadsEnabled && !ended) {
        return NextResponse.json(
          { error: "La subida de fotos todavía no está habilitada para este evento." },
          { status: 400 }
        );
      }
      linkedEvent = {
        id: ev.id,
        type: ev.type,
        latitude: ev.latitude,
        longitude: ev.longitude,
        city: ev.city,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
      };
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "El título del álbum es requerido" },
        { status: 400 }
      );
    }

    /** Solo si llega desde clientes nuevos (p. ej. wizard). Omitido ⇒ default del schema (@default(SIMPLE)). */
    let validatedAlbumMode: AlbumMode | undefined;
    if (
      bodyMode !== undefined &&
      bodyMode !== null &&
      !(typeof bodyMode === "string" && bodyMode.trim() === "")
    ) {
      const normalized =
        typeof bodyMode === "string"
          ? bodyMode.trim().toUpperCase()
          : String(bodyMode).trim().toUpperCase();
      const allowed = Object.values(AlbumMode) as string[];
      if (!allowed.includes(normalized)) {
        return NextResponse.json(
          {
            error: `Modo de álbum inválido. Recibido: "${String(bodyMode).trim()}". Valores permitidos: ${allowed.join(", ")}.`,
          },
          { status: 400 }
        );
      }
      validatedAlbumMode = normalized as AlbumMode;
    }

    // Coordenadas opcionales (georeferenciación del álbum fuera de flujo eventId)
    let optionalGeo: { latitude: number; longitude: number; geohash: string } | null = null;
    if (
      bodyLatitude !== undefined &&
      bodyLatitude !== null &&
      bodyLongitude !== undefined &&
      bodyLongitude !== null
    ) {
      const lat = Number(bodyLatitude);
      const lng = Number(bodyLongitude);
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        optionalGeo = { latitude: lat, longitude: lng, geohash: encodeGeohash(lat, lng) };
      }
    }

    // Parsear margen de ganancia si viene (mínimo 0% para habilitar)
    let parsedMargin: number | null = null;
    if (albumProfitMarginPercent !== undefined && albumProfitMarginPercent !== null) {
      const parsed = parseFloat(String(albumProfitMarginPercent));
      if (!isNaN(parsed)) {
        parsedMargin = parsed >= 0 ? parsed : null;
      }
    }

    // Parsear precio digital si viene (mínimo definido por configuración)
    let parsedDigital: number | null = null;
    if (digitalPhotoPriceCents !== undefined && digitalPhotoPriceCents !== null) {
      const parsed = parseInt(String(digitalPhotoPriceCents));
      if (!isNaN(parsed) && parsed >= 0) {
        // Validar precio mínimo desde AppConfig
        const appConfig = await prisma.appConfig.findUnique({ where: { id: 1 } });
      const minPrice = appConfig?.minDigitalPhotoPrice ?? 5000;
        parsedDigital = parsed >= minPrice ? parsed : null;
      }
    }

    // Generar slug único
    let publicSlug: string;
    let attempts = 0;
    do {
      const randomString = crypto.randomBytes(4).toString("hex");
      publicSlug = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${randomString}`;
      attempts++;
      if (attempts > 10) {
        publicSlug = crypto.randomUUID();
        break;
      }
    } while (await prisma.album.findUnique({ where: { publicSlug } }));

    // Fecha/horario del evento (álbumes sin evento vinculado)
    let standaloneSchedule: {
      eventDate: Date | null;
      startsAt: Date | null;
      endsAt: Date | null;
    } | null = null;
    if (!linkedEvent) {
      const scheduleTouched =
        eventDate !== undefined ||
        eventStartTime !== undefined ||
        eventEndTime !== undefined;
      if (scheduleTouched) {
        const scheduleInput = {
          eventDate: eventDate != null ? String(eventDate) : null,
          eventStartTime: eventStartTime != null ? String(eventStartTime) : null,
          eventEndTime: eventEndTime != null ? String(eventEndTime) : null,
        };
        const validation = validateAlbumEventSchedule(scheduleInput);
        if (!validation.ok) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        standaloneSchedule = parseAlbumEventScheduleInput(scheduleInput);
      } else {
        standaloneSchedule = { eventDate: null, startsAt: null, endsAt: null };
      }
    }

    // Legacy: body.eventDate en álbumes vinculados a evento (sin cambiar flujo linkedEvent)
    let parsedEventDate: Date | null = null;
    if (linkedEvent && eventDate) {
      parsedEventDate = new Date(eventDate);
      if (isNaN(parsedEventDate.getTime())) {
        parsedEventDate = null;
      }
    }

    // Validar selectedLabId si viene
    let parsedSelectedLabId: number | null = null;
    if (selectedLabId !== undefined && selectedLabId !== null) {
      const parsed = parseInt(String(selectedLabId));
      if (!isNaN(parsed) && parsed > 0) {
        // Verificar que el laboratorio existe
        const lab = await prisma.lab.findUnique({ where: { id: parsed } });
        if (lab) {
          parsedSelectedLabId = parsed;
        }
      }
    }

    // Validar pickupBy
    const parsedPickupBy = (pickupBy === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : "CLIENT") as "CLIENT" | "PHOTOGRAPHER";

    const termsAcceptedOk = termsAccepted === true;

    const parsedHiddenPhotosEnabled = Boolean(hiddenPhotosEnabled);
    let parsedHiddenSelfieRetentionDays: number | null = null;
    if (hiddenSelfieRetentionDays !== undefined && hiddenSelfieRetentionDays !== null && hiddenSelfieRetentionDays !== "") {
      const days = parseInt(String(hiddenSelfieRetentionDays), 10);
      parsedHiddenSelfieRetentionDays = Number.isFinite(days) && days >= 0 ? days : null;
    }

    const { enableDigital, enablePrinted } = resolveCreateAlbumSaleChannels({
      enableDigitalPhotos,
      enablePrintedPhotos,
    });

    if (enablePrinted) {
      const hasProducts = await photographerHasActiveProducts(user.id);
      if (!hasProducts) {
        return NextResponse.json(
          { error: "Para habilitar impresas, primero cargá productos en tu lista de precios." },
          { status: 400 }
        );
      }
    }
    const parsedPrintPricingSource = printPricingSource === "LAB_PREFERRED" ? "LAB_PREFERRED" : "PHOTOGRAPHER";
    const parsedDigitalWithPrintDiscount = Number.isFinite(Number(digitalWithPrintDiscountPercent))
      ? Math.min(100, Math.max(0, Number(digitalWithPrintDiscountPercent)))
      : 0;

    /** Escuela y comisión (solo creación modo SCHOOL desde wizard / clientes nuevos). */
    let parsedSchoolId: number | null = null;
    if (validatedAlbumMode === AlbumMode.SCHOOL) {
      const rawSid = body.schoolId;
      if (rawSid !== undefined && rawSid !== null && String(rawSid).trim() !== "") {
        const sid = parseInt(String(rawSid), 10);
        if (!Number.isFinite(sid) || sid <= 0) {
          return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
        }
        const school = await prisma.school.findUnique({
          where: { id: sid },
          select: { ownerId: true },
        });
        if (!school || school.ownerId !== user.id) {
          return NextResponse.json(
            { error: "Escuela no encontrada o no te pertenece" },
            { status: 400 }
          );
        }
        parsedSchoolId = sid;
      }
    }

    let parsedAcademicYearId: number | null = null;
    let parsedSelectedCourseKeys: string[] = [];
    if (validatedAlbumMode === AlbumMode.SCHOOL && parsedSchoolId != null) {
      const rawAy = (body as { academicYearId?: unknown }).academicYearId;
      if (rawAy !== undefined && rawAy !== null && String(rawAy).trim() !== "") {
        const yid = parseInt(String(rawAy), 10);
        if (!Number.isFinite(yid) || yid <= 0) {
          return NextResponse.json({ error: "academicYearId inválido" }, { status: 400 });
        }
        const ay = await prisma.academicYear.findFirst({
          where: { id: yid, schoolId: parsedSchoolId },
          select: { id: true },
        });
        if (!ay) {
          return NextResponse.json(
            {
              error: "El año lectivo no existe o no pertenece a la escuela seleccionada.",
            },
            { status: 400 }
          );
        }
        parsedAcademicYearId = yid;
      }

      const keysParsed = parseSelectedCourseKeysFromBody(
        (body as { selectedCourseKeys?: unknown }).selectedCourseKeys
      );
      if (!keysParsed.ok) {
        return NextResponse.json({ error: keysParsed.error }, { status: 400 });
      }
      parsedSelectedCourseKeys = keysParsed.keys;
    }

    const organizerCommissionEnabled =
      validatedAlbumMode === AlbumMode.SCHOOL ? Boolean(body.organizerCommissionEnabled) : false;
    let organizerCommissionPct: number | null = null;
    let organizerCommissionApplies: OrganizerCommissionAppliesTo[] = [OrganizerCommissionAppliesTo.PREVENTA];

    if (validatedAlbumMode === AlbumMode.SCHOOL && organizerCommissionEnabled) {
      if (parsedSchoolId == null) {
        return NextResponse.json(
          {
            error: "Para activar la comisión escolar necesitás vincular una escuela a este álbum.",
          },
          { status: 400 }
        );
      }
      const p = Number(body.organizerCommissionPercentage);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        return NextResponse.json(
          { error: "La comisión escolar debe ser un porcentaje entre 0 y 100." },
          { status: 400 }
        );
      }
      organizerCommissionPct = p;
      if (Array.isArray(body.organizerCommissionAppliesTo)) {
        const allowed = new Set<OrganizerCommissionAppliesTo>([
          OrganizerCommissionAppliesTo.PREVENTA,
          OrganizerCommissionAppliesTo.POST_EVENT,
          OrganizerCommissionAppliesTo.EXTRAS,
        ]);
        const parsedApplies = (body.organizerCommissionAppliesTo as unknown[])
          .map((x) => String(x).trim())
          .filter((x): x is OrganizerCommissionAppliesTo =>
            allowed.has(x as OrganizerCommissionAppliesTo)
          );
        if (parsedApplies.length > 0) organizerCommissionApplies = parsedApplies;
      }
    }

    const albumData: any = {
      userId: user.id,
      title: title.trim(),
      location: location?.trim() || null,
      eventDate: standaloneSchedule?.eventDate ?? parsedEventDate,
      ...(standaloneSchedule
        ? {
            startsAt: standaloneSchedule.startsAt,
            endsAt: standaloneSchedule.endsAt,
          }
        : {}),
      publicSlug,
      albumProfitMarginPercent: parsedMargin,
      printPricingSource: parsedPrintPricingSource,
      digitalPhotoPriceCents: parsedDigital,
      enablePrintedPhotos: enablePrinted,
      enableDigitalPhotos: enableDigital,
      includeDigitalWithPrint: includeDigitalWithPrint !== undefined ? Boolean(includeDigitalWithPrint) : false,
      digitalWithPrintDiscountPercent: includeDigitalWithPrint ? parsedDigitalWithPrintDiscount : 0,
      allowClientLabSelection: false,
      showComingSoonMessage: showComingSoonMessage !== undefined ? Boolean(showComingSoonMessage) : false,
      isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
      hiddenPhotosEnabled: parsedHiddenPhotosEnabled,
      hiddenSelfieRetentionDays: parsedHiddenSelfieRetentionDays,
      ...(termsAcceptedOk && { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION }),
      digitalDiscount5Plus: digitalDiscount5Plus !== undefined && digitalDiscount5Plus !== null ? parseFloat(String(digitalDiscount5Plus)) : null,
      digitalDiscount10Plus: digitalDiscount10Plus !== undefined && digitalDiscount10Plus !== null ? parseFloat(String(digitalDiscount10Plus)) : null,
      digitalDiscount20Plus: digitalDiscount20Plus !== undefined && digitalDiscount20Plus !== null ? parseFloat(String(digitalDiscount20Plus)) : null,
      ...(validatedAlbumMode !== undefined ? { mode: validatedAlbumMode } : {}),
      ...(optionalGeo ? { latitude: optionalGeo.latitude, longitude: optionalGeo.longitude, geohash: optionalGeo.geohash } : {}),
      ...(validatedAlbumMode === AlbumMode.SCHOOL && parsedSchoolId != null ? { schoolId: parsedSchoolId } : {}),
      ...(validatedAlbumMode === AlbumMode.SCHOOL
        ? {
            organizerCommissionEnabled,
            organizerCommissionPercentage: organizerCommissionEnabled ? organizerCommissionPct : null,
            organizerCommissionAppliesTo: organizerCommissionApplies,
          }
        : {}),
      ...(validatedAlbumMode === AlbumMode.SCHOOL && parsedAcademicYearId != null
        ? { academicYearId: parsedAcademicYearId }
        : {}),
      ...(validatedAlbumMode === AlbumMode.SCHOOL && parsedSelectedCourseKeys.length > 0
        ? { selectedCourseKeys: parsedSelectedCourseKeys }
        : {}),
    };

    const shouldSyncRosterFromEnrollments =
      validatedAlbumMode === AlbumMode.SCHOOL &&
      parsedSchoolId != null &&
      parsedAcademicYearId != null &&
      parsedSelectedCourseKeys.length > 0;

    // Agregar selectedLabId y pickupBy. FASE 1: sin lab → impresión a cargo del fotógrafo, pickupBy = PHOTOGRAPHER.
    // TODO FASE 2: cuando selectedLabId != null y allowClientLabSelection = true, permitir selección de lab por cliente.
    if (parsedSelectedLabId !== null) {
      albumData.selectedLabId = parsedSelectedLabId;
      albumData.pickupBy = parsedPickupBy;
    } else if (enablePrinted) {
      albumData.pickupBy = "PHOTOGRAPHER";
    } else {
      albumData.pickupBy = parsedPickupBy;
    }

    if (linkedEvent) {
      albumData.eventId = linkedEvent.id;
      albumData.creatorId = user.id;
      albumData.type = linkedEvent.type;
      albumData.latitude = linkedEvent.latitude;
      albumData.longitude = linkedEvent.longitude;
      albumData.geohash = encodeGeohash(linkedEvent.latitude, linkedEvent.longitude);
      albumData.city = linkedEvent.city;
      albumData.startsAt = linkedEvent.startsAt;
      albumData.endsAt = linkedEvent.endsAt;
      const eventAlbumVisibility = eventPhotographerAlbumVisibilityForEventJoin();
      albumData.isPublic = eventAlbumVisibility.isPublic;
      albumData.isHidden = eventAlbumVisibility.isHidden;
    }

    let album;
    try {
      album = await prisma.$transaction(async (tx) => {
        const created = await tx.album.create({
          data: albumData,
        });
        if (shouldSyncRosterFromEnrollments) {
          await ensureAlbumRosterFromEnrollments(tx, {
            albumId: created.id,
            schoolId: parsedSchoolId!,
            academicYearId: parsedAcademicYearId!,
            selectedCourseKeys: parsedSelectedCourseKeys,
          });
        }
        return created;
      });
    } catch (createError: any) {
      // Si falla por campos desconocidos, intentar solo con campos básicos
      const errorMsg = String(createError?.message ?? "");
      if (errorMsg.includes("Unknown argument") || errorMsg.includes("Unknown column")) {
        console.warn("Schema no actualizado, creando álbum solo con campos básicos. Ejecuta: npx prisma db push && npx prisma generate");
        // Solo usar campos básicos que siempre existen en el schema
        const basicData: any = {
          userId: albumData.userId,
          title: albumData.title,
          location: albumData.location,
          eventDate: albumData.eventDate,
          publicSlug: albumData.publicSlug,
          albumProfitMarginPercent: albumData.albumProfitMarginPercent,
          digitalPhotoPriceCents: albumData.digitalPhotoPriceCents,
          ...(validatedAlbumMode !== undefined ? { mode: validatedAlbumMode } : {}),
          ...(optionalGeo
            ? { latitude: optionalGeo.latitude, longitude: optionalGeo.longitude, geohash: optionalGeo.geohash }
            : {}),
        };
        album = await prisma.album.create({
          data: basicData,
        });
      } else {
        throw createError;
      }
    }

    let hiddenColumnsWarning: string | null = null;
    if (
      parsedHiddenPhotosEnabled &&
      album &&
      !(album as { hiddenPhotosEnabled?: boolean }).hiddenPhotosEnabled
    ) {
      hiddenColumnsWarning =
        "No se pudo guardar «fotos ocultas hasta selfie» (columnas pendientes en la base). Ejecutá: npx prisma migrate deploy";
    }

    let hiddenAnalysisQueued = 0;
    if ((album as { hiddenPhotosEnabled?: boolean }).hiddenPhotosEnabled) {
      try {
        hiddenAnalysisQueued = await ensureAlbumPhotosQueuedForHiddenMode(album.id);
      } catch (queueErr) {
        console.warn("No se pudo encolar análisis facial para fotos ocultas:", queueErr);
      }
    }

    return NextResponse.json({
      ...album,
      photosCount: 0,
      ...(hiddenColumnsWarning ? { _warning: hiddenColumnsWarning } : {}),
      ...(hiddenAnalysisQueued > 0 ? { _hiddenAnalysisQueued: hiddenAnalysisQueued } : {}),
    });
  } catch (err: any) {
    console.error("POST /api/dashboard/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
