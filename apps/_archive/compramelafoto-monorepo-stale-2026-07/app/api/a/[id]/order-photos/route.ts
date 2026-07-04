import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { getAppConfig } from "@/lib/services/settingsService";
import { isAlbumComplete, isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { getAuthUser } from "@/lib/auth";

async function buildOrderPhotosResponse(albumId: number, photoIds: number[]) {
  // Intentar cargar con selectedLab, si falla cargar sin él (schema no actualizado)
  let album: any;
  try {
    album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        user: { 
          select: { 
            id: true,
            preferredLabId: true, 
            profitMarginPercent: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            province: true,
            country: true,
            logoUrl: true,
            secondaryColor: true,
            tertiaryColor: true,
            isPublicPageEnabled: true,
            publicPageHandler: true,
          } 
        },
        selectedLab: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            province: true,
            country: true,
          },
        },
        photos: { where: { id: { in: photoIds }, isRemoved: false }, select: { id: true, previewUrl: true, originalKey: true, userId: true, sellDigital: true, sellPrint: true } },
      },
    });
  } catch (includeError: any) {
    // Si falla por selectedLab o isRemoved, intentar sin ellos
    const missingSelectedLab = includeError?.message?.includes("selectedLab");
    const missingIsRemoved = includeError?.message?.includes("isRemoved");
    const isSchemaError = missingSelectedLab || missingIsRemoved || includeError?.message?.includes("Unknown argument");
    
    if (isSchemaError) {
      console.warn("Schema no actualizado, cargando álbum sin campos nuevos");
      try {
        const photosSelect = missingIsRemoved
          ? { id: true, previewUrl: true, originalKey: true, userId: true, sellDigital: true, sellPrint: true }
          : { id: true, previewUrl: true, originalKey: true, isRemoved: true, userId: true, sellDigital: true, sellPrint: true };

        album = await prisma.album.findUnique({
          where: { id: albumId },
          include: {
            user: { 
              select: { 
                id: true,
                preferredLabId: true, 
                profitMarginPercent: true,
                name: true,
                phone: true,
                address: true,
                city: true,
                province: true,
                country: true,
                logoUrl: true,
                secondaryColor: true,
                tertiaryColor: true,
                isPublicPageEnabled: true,
                publicPageHandler: true,
              } 
            },
            photos: { 
              where: { id: { in: photoIds } }, 
              select: photosSelect,
            },
          },
        });
        // Agregar selectedLab como null si no existe y filtrar fotos removidas
        if (album) {
          album.selectedLab = null;
          if (album.photos && !missingIsRemoved) {
            album.photos = album.photos.filter((p: any) => !p.isRemoved);
          }
        }
      } catch (secondError: any) {
        // Fallback final: cargar con queries mínimos para evitar columnas inexistentes
        console.warn("Fallback mínimo por schema desfasado:", secondError?.message || secondError);
        const albumBasic = await prisma.album.findUnique({
          where: { id: albumId },
          select: {
            id: true,
            userId: true,
            createdAt: true,
            isPublic: true,
            isHidden: true,
            enablePrintedPhotos: true,
            enableDigitalPhotos: true,
            selectedLabId: true,
            albumProfitMarginPercent: true,
            pickupBy: true,
            digitalPhotoPriceCents: true,
            termsAcceptedAt: true,
            termsVersion: true,
          },
        });
        if (!albumBasic) {
          return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
        }
        const photosBasic = await prisma.photo.findMany({
          where: { albumId, id: { in: photoIds } },
          select: { id: true, previewUrl: true, originalKey: true, userId: true, sellDigital: true, sellPrint: true },
        });
        const userBasic = albumBasic.userId
          ? await prisma.user.findUnique({
              where: { id: albumBasic.userId },
              select: { id: true, name: true, phone: true, address: true, city: true, province: true, country: true },
            })
          : null;

        album = {
          ...albumBasic,
          user: userBasic,
          selectedLab: null,
          photos: photosBasic,
        };
      }
    } else {
      throw includeError;
    }
  }

  if (!album) {
    return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
  }

  if (!isAlbumComplete(album)) {
    return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
  }

  if (!isAlbumPubliclyAccessible(album)) {
    const authUser = await getAuthUser();
    const isOwner = authUser?.id === album.userId;
    const hasAccess = authUser
      ? await prisma.albumAccess.findUnique({
          where: { albumId_userId: { albumId, userId: authUser.id } },
        })
      : null;
    if (!isOwner && !hasAccess) {
      return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
    }
  }

  const fallbackUploaderId = album.user?.id ?? album.userId ?? null;
  const uploaderIds = Array.from(
    new Set(
      (album.photos || [])
        .map((p: { userId?: number | null }) => p.userId ?? fallbackUploaderId)
        .filter((id: number | null) => Number.isFinite(id as number))
    )
  ) as number[];
  const uploaderUsers = uploaderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, defaultDigitalPhotoPrice: true },
      })
    : [];
  const appConfig = await getAppConfig();
  const platformMinDigital = appConfig?.minDigitalPhotoPrice ?? 5000;
  const uploaderDigitalMap = new Map<number, number | null>();
  uploaderUsers.forEach((u) => uploaderDigitalMap.set(u.id, u.defaultDigitalPhotoPrice ?? platformMinDigital));

  // Álbum colaborativo: cada fotógrafo define su precio (defaultDigitalPhotoPrice).
  // Solo las fotos del dueño del álbum usan el precio del álbum cuando está configurado.
  const albumOwnerId = album.user?.id ?? album.userId ?? null;
  const albumDigitalPriceCents = (album as { digitalPhotoPriceCents?: number | null }).digitalPhotoPriceCents;
  const albumHasPrice = albumDigitalPriceCents != null && albumDigitalPriceCents > 0;

  const files = album.photos.map((p: { id: number; previewUrl: string; originalKey: string; userId?: number | null; sellDigital?: boolean; sellPrint?: boolean }) => {
    const uploaderId = p.userId ?? fallbackUploaderId;
    const url = `/api/photos/${p.id}/view?albumId=${albumId}&mode=preview`;
    const uploaderPrice = uploaderId ? uploaderDigitalMap.get(uploaderId) ?? null : null;
    // Fotógrafo dueño: precio del álbum. Colaboradores: precio individual de cada uno.
    const price = (uploaderId === albumOwnerId && albumHasPrice)
      ? albumDigitalPriceCents
      : uploaderPrice;
    return {
      fileKey: p.originalKey,
      url,
      originalName: `foto-${p.id}.jpg`,
      uploaderId: uploaderId ?? null,
      uploaderDigitalPriceCents: price,
      sellDigital: p.sellDigital ?? true,
      sellPrint: p.sellPrint ?? true,
    };
  });

  const u = album.user as { 
    id?: number;
    preferredLabId?: number | null; 
    profitMarginPercent?: number | null;
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    logoUrl?: string | null;
    secondaryColor?: string | null;
    tertiaryColor?: string | null;
    isPublicPageEnabled?: boolean;
    publicPageHandler?: string | null;
  } | null;
  
  const profitMargin = (album as { albumProfitMarginPercent?: number | null }).albumProfitMarginPercent
    ?? u?.profitMarginPercent ?? 0;

  const selectedLabId = (album as { selectedLabId?: number | null }).selectedLabId ?? u?.preferredLabId ?? null;
  const pickupBy = (album as { pickupBy?: "CLIENT" | "PHOTOGRAPHER" | null }).pickupBy ?? "CLIENT";

  let platformPercent = 10;
  try {
    platformPercent = await resolvePlatformCommissionPercent({
      photographerId: u?.id ?? album.userId ?? null,
      labId: selectedLabId,
    });
  } catch (configError) {
    console.warn("No se pudo resolver el fee de plataforma, usando valor por defecto:", configError);
  }
  const baseDate = (album as { firstPhotoDate?: Date | null }).firstPhotoDate || (album as { createdAt?: Date }).createdAt;
  const extensionDays = (album as { expirationExtensionDays?: number | null }).expirationExtensionDays ?? 0;
  const baseEnd = baseDate ? new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const extensionEnd = baseDate ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const extensionPricingActive = Boolean(
    baseEnd && extensionEnd && extensionDays > 0 && now >= baseEnd && now <= extensionEnd
  );
  // Recargo por extensión: 15% por archivo cada 30 días (se calcula en el motor de precios al hacer quote)
  const extensionDaysRemaining = extensionEnd ? Math.max(0, Math.ceil((extensionEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : null;

  const pricing = {
    photographerId: u?.id ?? null,
    digitalPhotoPriceCents: (album as { digitalPhotoPriceCents?: number | null }).digitalPhotoPriceCents ?? null,
    preferredLabId: selectedLabId,
    selectedLabId: selectedLabId,
    profitMarginPercent: Number(profitMargin) || 0,
    pickupBy,
    enablePrintedPhotos: (album as { enablePrintedPhotos?: boolean }).enablePrintedPhotos ?? true,
    enableDigitalPhotos: (album as { enableDigitalPhotos?: boolean }).enableDigitalPhotos ?? true,
    includeDigitalWithPrint: (album as { includeDigitalWithPrint?: boolean }).includeDigitalWithPrint ?? false,
    digitalWithPrintDiscountPercent: (album as { digitalWithPrintDiscountPercent?: number | null }).digitalWithPrintDiscountPercent ?? 0,
    allowClientLabSelection: false,
    extensionPricingActive,
    extensionBaseEndsAt: baseEnd ? baseEnd.toISOString() : null,
    extensionEndsAt: extensionEnd ? extensionEnd.toISOString() : null,
    extensionDaysRemaining,
    pickupInfo: pickupBy === "CLIENT" && album.selectedLab && album.selectedLab.name
      ? {
          type: "LAB" as const,
          name: album.selectedLab.name,
          phone: album.selectedLab.phone,
          address: album.selectedLab.address,
          city: album.selectedLab.city,
          province: album.selectedLab.province,
          country: album.selectedLab.country,
        }
      : pickupBy === "PHOTOGRAPHER" && u && u.name
      ? {
          type: "PHOTOGRAPHER" as const,
          name: u.name,
          phone: u.phone,
          address: u.address,
          city: u.city,
          province: u.province,
          country: u.country,
        }
      : null,
  };

  // Incluir información del fotógrafo si tiene página pública habilitada
  const photographer = u && u.isPublicPageEnabled && u.publicPageHandler
    ? {
        id: u.id,
        name: u.name,
        logoUrl: u.logoUrl,
        secondaryColor: u.secondaryColor,
        tertiaryColor: u.tertiaryColor,
        publicPageHandler: u.publicPageHandler,
      }
    : null;

  return NextResponse.json(
    { files, pricing, photographer },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

/**
 * GET /api/a/[id]/order-photos?ids=1,2,3
 * Devuelve las fotos de un álbum (público) para usarlas en el flujo de impresión.
 * ids: ids de fotos separados por coma; solo se devuelven las que pertenecen al álbum.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const idsParam = req.nextUrl.searchParams.get("ids");
    const photoIds = idsParam
      ? idsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite)
      : [];

    return await buildOrderPhotosResponse(albumId, photoIds);
  } catch (e) {
    console.error("GET /api/a/[id]/order-photos", e);
    return NextResponse.json({ error: "Error obteniendo fotos" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const photoIds = ids.map((value: any) => parseInt(String(value), 10)).filter(Number.isFinite);

    return await buildOrderPhotosResponse(albumId, photoIds);
  } catch (e) {
    console.error("POST /api/a/[id]/order-photos", e);
    return NextResponse.json({ error: "Error obteniendo fotos" }, { status: 500 });
  }
}
