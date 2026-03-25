import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getR2PublicUrl, normalizePreviewUrl } from "@/lib/r2-client";
import { Role } from "@prisma/client";
import crypto from "crypto";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
          photos: { select: { id: true, userId: true } },
          coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      albumsWithCount = albums.map((album) => {
        const hasOtherContributors = (album.photos as { userId?: number | null }[]).some(
          (p) => p.userId != null && p.userId !== user.id
        );
        const myPhotosCount = (album.photos as { userId?: number | null }[]).filter(
          (p) => p.userId === user.id || p.userId == null
        ).length;
        const isCollaborative = album.userId !== user.id;
        return {
          ...album,
          photosCount: album.photos.length,
          myPhotosCount,
          hasOtherContributors,
          isCollaborative,
          expirationExtensionDays: (album as any).expirationExtensionDays ?? 0,
          coverPhotoUrl: album.coverThumbnailKey
            ? getR2PublicUrl(album.coverThumbnailKey)
            : album.coverPhoto
              ? (normalizePreviewUrl(album.coverPhoto.previewUrl, album.coverPhoto.originalKey) ?? (album.coverPhoto.originalKey ? getR2PublicUrl(album.coverPhoto.originalKey) : null))
              : null,
          showComingSoonMessage: album.showComingSoonMessage || false,
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
            photos: { select: { id: true, userId: true } },
            hiddenPhotosEnabled: true,
            hiddenSelfieRetentionDays: true,
          },
          orderBy: { createdAt: "desc" },
        });

        albumsWithCount = albums.map((album: any) => {
          const hasOtherContributors = (album.photos || []).some(
            (p: { userId?: number | null }) => p.userId != null && p.userId !== user.id
          );
          const myPhotosCount = (album.photos || []).filter(
            (p: { userId?: number | null }) => p.userId === user.id || p.userId == null
          ).length;
          const isCollaborative = album.userId !== user.id;
          return {
            ...album,
            photosCount: (album.photos || []).length,
            myPhotosCount,
            hasOtherContributors,
            isCollaborative,
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
              photos: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
          });
          albumsWithCount = albums.map((album: any) => ({
            ...album,
            photosCount: (album.photos || []).length,
            myPhotosCount: (album.photos || []).length,
            hasOtherContributors: false,
            isCollaborative: false,
            expirationExtensionDays: 0,
            coverPhotoUrl: null,
            showComingSoonMessage: album.showComingSoonMessage || false,
            firstPhotoDate: album.firstPhotoDate || null,
            hiddenPhotosEnabled: false,
            hiddenSelfieRetentionDays: null,
          }));
        } else {
          throw fallbackErr;
        }
      }
    }

    return NextResponse.json(albumsWithCount);
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
    const { title, location, eventDate, albumProfitMarginPercent, printPricingSource, digitalPhotoPriceCents, selectedLabId, pickupBy, enablePrintedPhotos, enableDigitalPhotos, includeDigitalWithPrint, digitalWithPrintDiscountPercent, showComingSoonMessage, isPublic, termsAccepted, digitalDiscount5Plus, digitalDiscount10Plus, digitalDiscount20Plus, joinAlbumId } = body;

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
            photos: {
              select: {
                id: true,
                userId: true,
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
          ...existingAlbum,
          photosCount: existingAlbum.photos.length,
          joined: true, // Indicar que se unió en lugar de crear
        });
      }
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "El título del álbum es requerido" },
        { status: 400 }
      );
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

    // Parsear fecha si viene
    let parsedEventDate: Date | null = null;
    if (eventDate) {
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

    // Construir el objeto de datos dinámicamente
    const enablePrinted = enablePrintedPhotos !== undefined ? Boolean(enablePrintedPhotos) : true;
    const enableDigital = enableDigitalPhotos !== undefined ? Boolean(enableDigitalPhotos) : true;

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

    const albumData: any = {
      userId: user.id,
      title: title.trim(),
      location: location?.trim() || null,
      eventDate: parsedEventDate,
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
      ...(termsAcceptedOk && { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION }),
      digitalDiscount5Plus: digitalDiscount5Plus !== undefined && digitalDiscount5Plus !== null ? parseFloat(String(digitalDiscount5Plus)) : null,
      digitalDiscount10Plus: digitalDiscount10Plus !== undefined && digitalDiscount10Plus !== null ? parseFloat(String(digitalDiscount10Plus)) : null,
      digitalDiscount20Plus: digitalDiscount20Plus !== undefined && digitalDiscount20Plus !== null ? parseFloat(String(digitalDiscount20Plus)) : null,
    };

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

    let album;
    try {
      album = await prisma.album.create({
        data: albumData,
        include: {
          photos: {
            select: {
              id: true,
            },
          },
        },
      });
    } catch (createError: any) {
      // Si falla por campos desconocidos, intentar solo con campos básicos
      const errorMsg = String(createError?.message ?? "");
      if (errorMsg.includes("Unknown argument") || errorMsg.includes("Unknown column")) {
        console.warn(
          "Schema no actualizado, creando álbum solo con campos básicos. Staging/prod: ejecutar solo `pnpm --filter @repo/db run db:migrate:deploy`."
        );
        // Solo usar campos básicos que siempre existen en el schema
        const basicData: any = {
          userId: albumData.userId,
          title: albumData.title,
          location: albumData.location,
          eventDate: albumData.eventDate,
          publicSlug: albumData.publicSlug,
          albumProfitMarginPercent: albumData.albumProfitMarginPercent,
          digitalPhotoPriceCents: albumData.digitalPhotoPriceCents,
        };
        album = await prisma.album.create({
          data: basicData,
          include: {
            photos: {
              select: {
                id: true,
              },
            },
          },
        });
      } else {
        throw createError;
      }
    }

    return NextResponse.json({
      ...album,
      photosCount: album.photos.length,
    });
  } catch (err: any) {
    console.error("POST /api/dashboard/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
