import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { processPhoto } from "@/lib/image-processing";
import { schedulePhotoVariantsOnUpload } from "@/lib/images/generate-photo-variants";
import { incrementPhotosUploaded } from "@/lib/platform-metrics";
import crypto from "crypto";
import { extractCapturedAtFromBuffer } from "@/lib/photo-exif";
import {
  isPhotoFolderValidationError,
  resolvePhotoUploadFolders,
  ensureAlbumUploadAccess,
} from "./upload-helpers";
import {
  assertAlbumFolderFeature,
  canViewAlbumFolders,
} from "@/lib/albums/album-folder-permissions";
import {
  PhotoAlbumFolderValidationError,
  resolvePhotoAlbumFolder,
} from "@/lib/albums/resolve-photo-album-folder";
import {
  PhotoEventFolderValidationError,
  resolvePhotoEventFolder,
} from "@/lib/events/resolve-photo-event-folder";
import {
  albumPhotoCursorWhere,
  buildAlbumPhotoListPageMeta,
  encodeAlbumPhotoListCursor,
  parseAlbumPhotoListQuery,
} from "@/lib/albums/album-photo-list-pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/photos?folderId=123|none
 * GET /api/dashboard/albums/[id]/photos?eventFolderId=123|none
 * Lista fotos del álbum filtradas por carpeta (álbum simple o evento colaborativo).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true, eventId: true, deletedAt: true, isPublic: true, isHidden: true },
    });
    if (!album || album.deletedAt) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const albumCtx = { id: albumId, ...album };
    const hasEventAlbum =
      typeof album.eventId === "number" &&
      Number.isFinite(album.eventId) &&
      album.eventId > 0;

    const folderIdRaw = req.nextUrl.searchParams.get("folderId");
    const eventFolderIdRaw = req.nextUrl.searchParams.get("eventFolderId");

    const listQuery = parseAlbumPhotoListQuery(req.nextUrl.searchParams);
    if ("error" in listQuery) {
      return NextResponse.json({ error: listQuery.error }, { status: 400 });
    }
    const { limit: pageLimit, cursor: pageCursor } = listQuery;
    const requestCursorRaw = req.nextUrl.searchParams.get("cursor");

    if (folderIdRaw && eventFolderIdRaw) {
      return NextResponse.json(
        { error: "Enviá solo folderId o eventFolderId, no ambos." },
        { status: 400 }
      );
    }

    let folderFilter: number | null | undefined;
    let eventFolderFilter: number | null | undefined;

    if (hasEventAlbum) {
      if (folderIdRaw != null && folderIdRaw !== "") {
        return NextResponse.json(
          { error: "Este álbum usa carpetas de evento; usá eventFolderId." },
          { status: 400 }
        );
      }

      if (eventFolderIdRaw == null || eventFolderIdRaw === "") {
        eventFolderFilter = undefined;
      } else if (eventFolderIdRaw === "none" || eventFolderIdRaw === "null") {
        eventFolderFilter = null;
      } else {
        try {
          const resolved = await resolvePhotoEventFolder({
            albumEventId: album.eventId,
            eventFolderIdRaw,
            uploadedByUserId: user.id,
          });
          eventFolderFilter = resolved?.id ?? null;
        } catch (e: unknown) {
          if (e instanceof PhotoEventFolderValidationError) {
            return NextResponse.json({ error: e.message }, { status: 400 });
          }
          throw e;
        }
      }
    } else {
      if (eventFolderIdRaw != null && eventFolderIdRaw !== "") {
        return NextResponse.json(
          { error: "Este álbum no usa carpetas de evento; usá folderId." },
          { status: 400 }
        );
      }

      const feature = assertAlbumFolderFeature(albumCtx);
      if (!feature.ok) {
        return NextResponse.json({ error: feature.error }, { status: feature.status });
      }

      if (!canViewAlbumFolders(albumCtx, user.id)) {
        return NextResponse.json({ error: "No tenés acceso a este álbum." }, { status: 403 });
      }

      if (folderIdRaw == null || folderIdRaw === "") {
        folderFilter = undefined;
      } else if (folderIdRaw === "none" || folderIdRaw === "null") {
        folderFilter = null;
      } else {
        try {
          const resolved = await resolvePhotoAlbumFolder({
            albumId,
            albumEventId: album.eventId,
            folderIdRaw,
          });
          folderFilter = resolved?.id ?? null;
        } catch (e: unknown) {
          if (e instanceof PhotoAlbumFolderValidationError) {
            return NextResponse.json({ error: e.message }, { status: 400 });
          }
          throw e;
        }
      }
    }

    const folderWhere = {
      albumId,
      isRemoved: false,
      ...(eventFolderFilter !== undefined
        ? eventFolderFilter === null
          ? { eventFolderId: null }
          : { eventFolderId: eventFolderFilter }
        : folderFilter === undefined
          ? {}
          : folderFilter === null
            ? { folderId: null }
            : { folderId: folderFilter }),
    };

    const totalCount = await prisma.photo.count({ where: folderWhere });

    const photos = await prisma.photo.findMany({
      where: {
        ...folderWhere,
        ...(pageCursor ? albumPhotoCursorWhere(pageCursor) : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(pageLimit != null ? { take: pageLimit + 1 } : {}),
      select: {
        id: true,
        previewUrl: true,
        originalKey: true,
        folderId: true,
        eventFolderId: true,
        userId: true,
        createdAt: true,
        sellDigital: true,
        sellPrint: true,
      },
    });

    let pagePhotos = photos;
    let nextCursor: string | null = null;
    if (pageLimit != null) {
      const hasMore = photos.length > pageLimit;
      pagePhotos = hasMore ? photos.slice(0, pageLimit) : photos;
      const last = pagePhotos[pagePhotos.length - 1];
      if (hasMore && last) {
        nextCursor = encodeAlbumPhotoListCursor(last.createdAt, last.id);
      }
    }

    const isOwner = album.userId === user.id;
    const enriched = pagePhotos.map((p) => ({
      ...p,
      canDelete: p.userId === user.id || (p.userId == null && isOwner),
    }));

    const pageMeta = buildAlbumPhotoListPageMeta({
      totalCount,
      limit: pageLimit,
      cursor: requestCursorRaw,
      nextCursor,
    });

    return NextResponse.json({
      photos: enriched,
      folderId: folderFilter === undefined ? null : folderFilter,
      eventFolderId: eventFolderFilter === undefined ? null : eventFolderFilter,
      count: enriched.length,
      ...pageMeta,
    });
  } catch (err: unknown) {
    console.error("GET /api/dashboard/albums/[id]/photos ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando fotos", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

// POST: Subir fotos a un álbum (con marca de agua en preview)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    // Bloquear subida si no tiene Mercado Pago conectado
    if (user.role === Role.LAB_PHOTOGRAPHER || user.role === Role.LAB) {
      const lab = await prisma.lab.findUnique({
        where: { userId: user.id },
        select: { mpConnectedAt: true, mpAccessToken: true, mpUserId: true },
      });
      const mpConnected = !!(lab?.mpConnectedAt && lab?.mpAccessToken && lab?.mpUserId);
      if (!mpConnected) {
        return NextResponse.json(
          { error: "Debés conectar Mercado Pago para subir fotos." },
          { status: 403 }
        );
      }
    } else {
      const photographer = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mpAccessToken: true },
      });
      if (!photographer?.mpAccessToken) {
        return NextResponse.json(
          { error: "Debés conectar Mercado Pago para subir fotos." },
          { status: 403 }
        );
      }
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    // Verificar que el álbum existe y es público (permite colaboración)
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        userId: true,
        isPublic: true,
        isHidden: true,
        eventId: true,
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    // Permitir subir fotos si:
    // 1. Es el creador del álbum, O
    // 2. El álbum es público y no está oculto (colaboración)
    if (album.userId !== user.id) {
      if (!album.isPublic || album.isHidden) {
        return NextResponse.json(
          { error: "Este álbum no permite colaboración. Solo el creador puede agregar fotos." },
          { status: 403 }
        );
      }
      // Si es público, permitir colaboración (cualquier usuario puede agregar fotos)
    }

    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No se subieron archivos" }, { status: 400 });
    }

    let resolvedFolders: { eventFolderId?: number; folderId?: number } = {};
    try {
      resolvedFolders = await resolvePhotoUploadFolders({
        albumId,
        albumEventId: album.eventId,
        userId: user.id,
        eventFolderIdRaw: formData.get("eventFolderId"),
        folderIdRaw: formData.get("folderId"),
        relativePathRaw: formData.get("relativePath"),
      });
    } catch (e: unknown) {
      if (isPhotoFolderValidationError(e)) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const folderData = {
      ...(resolvedFolders.eventFolderId != null
        ? { eventFolderId: resolvedFolders.eventFolderId }
        : {}),
      ...(resolvedFolders.folderId != null ? { folderId: resolvedFolders.folderId } : {}),
    };

    const saved: Array<{ id: number; previewUrl: string; originalKey: string }> = [];
    const failed: Array<{ name: string; error: string }> = [];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    for (const f of files) {
      if (!(f instanceof File)) continue;

      if (f.size > maxSizeBytes) {
        failed.push({
          name: f.name || "archivo",
          error: "El archivo supera el límite de 10MB.",
        });
        continue;
      }

      const bytes = await f.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const originalName = f.name || "archivo";
      const fileKey = `${crypto.randomUUID()}.jpg`;

      try {
        // Procesar la imagen CON marca de agua (applyWatermark: true)
        // Esto genera:
        // - previewUrl: versión en baja resolución CON marca de agua (PNG + texto "@compramelafoto")
        // - originalKey: versión en alta calidad SIN marca de agua (para entrega cuando compre)
        const { previewUrl, originalKey } = await processPhoto(
          buffer,
          fileKey,
          true,
          `albums/${albumId}`
        );
        const capturedAt = await extractCapturedAtFromBuffer(buffer);

        // Guardar en la base de datos (userId = quien sube; para colaborativos y regla "solo eliminar lo propio")
        let photo;
        try {
          photo = await prisma.photo.create({
            data: {
              albumId,
              userId: user.id,
              previewUrl,
              originalKey,
              capturedAt,
              analysisStatus: "PENDING",
              exifMetadataStatus: "PENDING",
              ...folderData,
            },
          });
        } catch (createErr: any) {
          const errorMsg = String(createErr?.message ?? "");
          // Manejar campos que pueden no existir en la base de datos (migraciones pendientes)
          if (
            errorMsg.includes("userId") ||
            errorMsg.includes("isRemoved") ||
            errorMsg.includes("analysisStatus") ||
            errorMsg.includes("exifMetadataStatus") ||
            errorMsg.includes("eventFolderId") ||
            errorMsg.includes("folderId") ||
            errorMsg.includes("Unknown argument") ||
            errorMsg.includes("does not exist")
          ) {
            // Intentar crear sin campos opcionales que pueden no existir en la BD
            photo = await prisma.photo.create({
              data: { albumId, previewUrl, originalKey },
            });
          } else {
            throw createErr;
          }
        }

        if (
          (resolvedFolders.eventFolderId != null &&
            typeof (photo as { eventFolderId?: number | null }).eventFolderId === "number") ||
          (resolvedFolders.folderId != null &&
            typeof (photo as { folderId?: number | null }).folderId === "number")
        ) {
          console.info("[photo-folder]", {
            albumId,
            photoId: photo.id,
            eventFolderId: resolvedFolders.eventFolderId,
            folderId: resolvedFolders.folderId,
          });
        }

        try {
          await prisma.photoAnalysisJob.create({
            data: {
              photoId: photo.id,
              status: "PENDING",
            },
          });
        } catch (jobErr: any) {
          const msg = String(jobErr?.message ?? "");
          if (!msg.includes("PhotoAnalysisJob") && !msg.includes("Unknown argument") && !msg.includes("does not exist")) {
            console.error("Error creando PhotoAnalysisJob:", jobErr);
          }
        }

        schedulePhotoVariantsOnUpload({
          id: photo.id,
          albumId,
          previewUrl,
          originalKey,
          createdAt: photo.createdAt,
        });

        await incrementPhotosUploaded(1).catch((err) => {
          console.warn("incrementPhotosUploaded:", err);
        });

        saved.push({
          id: photo.id,
          previewUrl,
          originalKey,
        });

        // Si es la primera foto del álbum, establecerla como portada y guardar firstPhotoDate
        if (saved.length === 1) {
          const albumCheck = await prisma.album.findUnique({
            where: { id: albumId },
            select: {
              coverPhotoId: true,
              firstPhotoDate: true,
              expiresAt: true,
              photos: { select: { id: true } },
            },
          });
          if (albumCheck && albumCheck.photos.length === 1) {
            const updateData: any = {};
            
            // Establecer como portada si no hay portada
            if (!albumCheck.coverPhotoId) {
              updateData.coverPhotoId = photo.id;
            }
            
            // Establecer firstPhotoDate si no está definida (es la primera foto)
            if (!albumCheck.firstPhotoDate) {
              updateData.firstPhotoDate = new Date();
            }

            if (!albumCheck.expiresAt) {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);
              updateData.expiresAt = expiresAt;
            }
            
            if (Object.keys(updateData).length > 0) {
              try {
                await prisma.album.update({
                  where: { id: albumId },
                  data: updateData,
                });
              } catch (updateErr: any) {
                // Si falla por campos desconocidos, ignorar (schema no actualizado)
                const errorMsg = String(updateErr?.message ?? "");
                if (!errorMsg.includes("coverPhotoId") && 
                    !errorMsg.includes("firstPhotoDate") && 
                    !errorMsg.includes("Unknown argument")) {
                  console.error("Error actualizando álbum:", updateErr);
                }
              }
            }
          }
        }
      } catch (processErr: any) {
        const errorMessage = String(processErr?.message ?? processErr);
        console.error(`Error procesando ${originalName}:`, processErr);
        failed.push({ name: originalName, error: errorMessage });
        // Continuar con las demás fotos si una falla
      }
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { 
          error: "No se pudo procesar ninguna foto", 
          detail: failed.length ? failed : undefined 
        },
        { status: 500 }
      );
    }

    // Disparar análisis inmediatamente después de subir las fotos (asíncrono, no bloquea la respuesta)
    // Esto evita esperar hasta 5 minutos para que el CRON procese las fotos
    if (saved.length > 0) {
      const triggerAnalysis = async () => {
        try {
          // Construir URL base
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
          
          const analysisUrl = new URL("/api/internal/analysis/run", baseUrl);
          const cronSecret = process.env.CRON_SECRET;
          if (cronSecret) {
            analysisUrl.searchParams.set("token", cronSecret);
          }
          
          // Hacer la llamada de forma asíncrona sin esperar la respuesta
          fetch(analysisUrl.toString(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }).catch((err) => {
            // Ignorar errores silenciosamente - el CRON seguirá procesando las fotos
            console.warn("No se pudo disparar análisis inmediato (el CRON lo procesará):", err?.message);
          });
        } catch (err) {
          // Ignorar errores - el CRON seguirá procesando las fotos
          console.warn("Error disparando análisis inmediato:", err);
        }
      };
      
      // Ejecutar de forma asíncrona sin bloquear la respuesta
      triggerAnalysis();
    }

    return NextResponse.json(
      { photos: saved, count: saved.length },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/dashboard/albums/[id]/photos ERROR >>>", err);
    return NextResponse.json(
      { error: "Error subiendo fotos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
