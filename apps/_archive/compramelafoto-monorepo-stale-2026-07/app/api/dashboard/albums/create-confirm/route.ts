import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import crypto from "crypto";
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";
import { encodeGeohash } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function photographerHasActiveProducts(userId: number): Promise<boolean> {
  const prismaAny = prisma as any;
  if (!prismaAny.photographerProduct?.findFirst) return true;
  const product = await prismaAny.photographerProduct.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  });
  return Boolean(product);
}

// POST: Confirmar creación o unión (selectedEventId | selectedAlbumId | createNew)
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const mpUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mpAccessToken: true },
    });
    if (!mpUser?.mpAccessToken) {
      return NextResponse.json(
        { error: "Debés vincular tu cuenta de Mercado Pago para crear álbumes.", redirectUrl: "/fotografo/configuracion?tab=laboratorio" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { selectedEventId, selectedAlbumId, createNew, ...albumFields } = body;

    // 1. Unirse a álbum existente
    if (selectedAlbumId && !createNew) {
      const albumId = parseInt(String(selectedAlbumId));
      if (isNaN(albumId) || albumId <= 0) {
        return NextResponse.json({ error: "Álbum inválido" }, { status: 400 });
      }

      const album = await prisma.album.findUnique({
        where: { id: albumId },
        select: { id: true, title: true, publicSlug: true, isPublic: true, isHidden: true, userId: true },
      });

      if (!album) {
        return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
      }
      if (album.userId === user.id) {
        return NextResponse.json({ error: "Ya sos el creador de este álbum" }, { status: 400 });
      }
      if (album.isHidden || !album.isPublic) {
        return NextResponse.json({ error: "Este álbum no está disponible para colaboración" }, { status: 403 });
      }

      await prisma.albumCollaborator.upsert({
        where: { albumId_userId: { albumId, userId: user.id } },
        create: { albumId, userId: user.id },
        update: {},
      });

      return NextResponse.json({
        ...album,
        photosCount: 0,
        joined: true,
      });
    }

    // 2. Crear álbum vinculado a Event
    if (selectedEventId && !createNew) {
      const eventId = parseInt(String(selectedEventId));
      if (isNaN(eventId) || eventId <= 0) {
        return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, title: true, latitude: true, longitude: true, startsAt: true, type: true, city: true },
      });

      if (!event) {
        return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
      }

      const title = albumFields.title?.trim() || event.title;
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

      const geohash = event.latitude != null && event.longitude != null
        ? encodeGeohash(event.latitude, event.longitude)
        : null;

      const albumData: any = {
        userId: user.id,
        creatorId: user.id,
        eventId: event.id,
        title,
        location: albumFields.location || event.title,
        eventDate: event.startsAt,
        publicSlug,
        type: event.type,
        latitude: event.latitude,
        longitude: event.longitude,
        geohash,
        startsAt: event.startsAt,
        city: event.city ?? albumFields.city ?? null,
        isPublic: albumFields.isPublic !== false,
        albumProfitMarginPercent: albumFields.albumProfitMarginPercent ?? null,
        printPricingSource: albumFields.printPricingSource ?? "PHOTOGRAPHER",
        digitalPhotoPriceCents: albumFields.digitalPhotoPriceCents ?? null,
        selectedLabId: albumFields.selectedLabId ?? null,
        pickupBy: albumFields.pickupBy ?? "CLIENT",
        enablePrintedPhotos: albumFields.enablePrintedPhotos !== false,
        enableDigitalPhotos: albumFields.enableDigitalPhotos !== false,
        includeDigitalWithPrint: Boolean(albumFields.includeDigitalWithPrint),
        digitalWithPrintDiscountPercent: albumFields.digitalWithPrintDiscountPercent ?? 0,
        showComingSoonMessage: Boolean(albumFields.showComingSoonMessage),
        allowClientLabSelection: false,
        termsAcceptedAt: albumFields.termsAccepted ? new Date() : null,
        termsVersion: albumFields.termsAccepted ? TERMS_VERSION : null,
        digitalDiscount5Plus: albumFields.digitalDiscount5Plus ?? null,
        digitalDiscount10Plus: albumFields.digitalDiscount10Plus ?? null,
        digitalDiscount20Plus: albumFields.digitalDiscount20Plus ?? null,
        hiddenPhotosEnabled: Boolean(albumFields.hiddenPhotosEnabled),
        hiddenSelfieRetentionDays: albumFields.hiddenSelfieRetentionDays != null && albumFields.hiddenSelfieRetentionDays !== ""
          ? parseInt(String(albumFields.hiddenSelfieRetentionDays), 10)
          : null,
      };

      const album = await prisma.album.create({
        data: albumData,
        include: { photos: { select: { id: true } } },
      });

      return NextResponse.json({ ...album, photosCount: album.photos.length });
    }

    // 3. Crear álbum nuevo (createNew)
    if (!createNew) {
      return NextResponse.json({ error: "Debés elegir un álbum/evento o crear uno nuevo" }, { status: 400 });
    }

    const title = albumFields.title?.trim();
    if (!title) {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    }

    const enablePrinted = albumFields.enablePrintedPhotos !== false;
    if (enablePrinted) {
      const hasProducts = await photographerHasActiveProducts(user.id);
      if (!hasProducts) {
        return NextResponse.json(
          { error: "Para habilitar impresas, primero cargá productos en tu lista de precios." },
          { status: 400 }
        );
      }
    }

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

    const lat = albumFields.lat != null ? parseFloat(String(albumFields.lat)) : null;
    const lng = albumFields.lng != null ? parseFloat(String(albumFields.lng)) : null;
    const geohash = lat != null && lng != null && !isNaN(lat) && !isNaN(lng) ? encodeGeohash(lat, lng) : null;
    const parsedStartsAt = albumFields.startsAt || albumFields.eventDate;
    const startsAt = parsedStartsAt ? new Date(parsedStartsAt) : null;

    const albumData: any = {
      userId: user.id,
      creatorId: user.id,
      title,
      location: albumFields.location?.trim() || null,
      eventDate: parsedStartsAt ? new Date(parsedStartsAt) : null,
      publicSlug,
      type: albumFields.type || null,
      latitude: lat,
      longitude: lng,
      geohash,
      startsAt,
      city: albumFields.city?.trim() || null,
      albumProfitMarginPercent: albumFields.albumProfitMarginPercent ?? null,
      printPricingSource: albumFields.printPricingSource ?? "PHOTOGRAPHER",
      digitalPhotoPriceCents: albumFields.digitalPhotoPriceCents ?? null,
      selectedLabId: albumFields.selectedLabId ?? null,
      pickupBy: albumFields.pickupBy ?? "CLIENT",
      enablePrintedPhotos: enablePrinted,
      enableDigitalPhotos: albumFields.enableDigitalPhotos !== false,
      includeDigitalWithPrint: Boolean(albumFields.includeDigitalWithPrint),
      digitalWithPrintDiscountPercent: albumFields.digitalWithPrintDiscountPercent ?? 0,
      showComingSoonMessage: Boolean(albumFields.showComingSoonMessage),
      isPublic: albumFields.isPublic !== false,
      allowClientLabSelection: false,
      termsAcceptedAt: albumFields.termsAccepted ? new Date() : null,
      termsVersion: albumFields.termsAccepted ? TERMS_VERSION : null,
      digitalDiscount5Plus: albumFields.digitalDiscount5Plus ?? null,
      digitalDiscount10Plus: albumFields.digitalDiscount10Plus ?? null,
      digitalDiscount20Plus: albumFields.digitalDiscount20Plus ?? null,
      hiddenPhotosEnabled: Boolean(albumFields.hiddenPhotosEnabled),
      hiddenSelfieRetentionDays: albumFields.hiddenSelfieRetentionDays != null && albumFields.hiddenSelfieRetentionDays !== ""
        ? parseInt(String(albumFields.hiddenSelfieRetentionDays), 10)
        : null,
    };

    const album = await prisma.album.create({
      data: albumData,
      include: { photos: { select: { id: true } } },
    });

    return NextResponse.json({ ...album, photosCount: album.photos.length });
  } catch (err: any) {
    console.error("POST /api/dashboard/albums/create-confirm ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al crear/confirmar álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
