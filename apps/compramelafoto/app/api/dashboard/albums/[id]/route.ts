import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role, PrintPricingSource } from "@prisma/client";
// Nota: Ya no usamos fs/promises para eliminar archivos, ahora usamos R2
import { TERMS_VERSION } from "@/lib/terms/photographerTerms";
import { normalizePreviewUrl } from "@/lib/r2-client";

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

// GET: Obtener álbum específico con sus fotos
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    let album: Record<string, unknown> | null;

    try {
      // coverPhoto: se usa originalKey (foto SIN marca de agua) para la portada
      album = await prisma.album.findUnique({
        where: { id: albumId },
        include: {
          photos: { orderBy: { createdAt: "desc" } },
          coverPhoto: { select: { id: true, originalKey: true } },
          selectedLab: { select: { id: true, name: true, city: true, province: true } },
          user: { select: { publicPageHandler: true } },
        },
      }) as Record<string, unknown> | null;
    } catch (dbErr: any) {
      const msg = String(dbErr?.message ?? dbErr);
      const isSchemaError =
        msg.includes("coverPhotoId") || msg.includes("coverPhoto") ||
        msg.includes("does not exist") || msg.includes("Unknown column") || msg.includes("Unknown argument") ||
        msg.includes("isRemoved") || msg.includes("sellDigital") || msg.includes("sellPrint");
      if (isSchemaError) {
        // Fallback cuando la columna coverPhotoId o isRemoved no existe
        try {
          album = await prisma.album.findUnique({
            where: { id: albumId },
            select: {
              id: true,
              title: true,
              location: true,
              eventDate: true,
              publicSlug: true,
              createdAt: true,
              userId: true,
              digitalPhotoPriceCents: true,
              isPublic: true,
              hiddenPhotosEnabled: true,
              hiddenSelfieRetentionDays: true,
              photos: {
                select: {
                  id: true,
                  originalKey: true,
                  previewUrl: true,
                  userId: true,
                  createdAt: true,
                  sellDigital: true,
                  sellPrint: true,
                },
                orderBy: { createdAt: "desc" },
              },
            },
          }) as Record<string, unknown> | null;
          if (album) {
            (album as any).coverPhotoId = null;
            try {
              const albumWithLab = await prisma.album.findUnique({
                where: { id: albumId },
                select: {
                  selectedLab: { select: { id: true, name: true, city: true, province: true } },
                },
              });
              if (albumWithLab?.selectedLab) {
                (album as any).selectedLab = albumWithLab.selectedLab;
              }
            } catch (labErr) {
              // Ignorar error de selectedLab
            }
          }
        } catch (fallbackErr: any) {
          const fallbackMsg = String(fallbackErr?.message ?? "");
          const useMinimalPhotos =
            fallbackMsg.includes("isRemoved") ||
            fallbackMsg.includes("sellDigital") ||
            fallbackMsg.includes("sellPrint") ||
            fallbackMsg.includes("Unknown column") ||
            fallbackMsg.includes("hiddenPhotosEnabled") ||
            fallbackMsg.includes("hiddenSelfieRetentionDays");
          // Si falla por isRemoved o por columnas inexistentes (migración no aplicada), cargar solo campos básicos
          if (useMinimalPhotos) {
            album = await prisma.album.findUnique({
              where: { id: albumId },
              select: {
                id: true,
                title: true,
                location: true,
                eventDate: true,
                publicSlug: true,
                createdAt: true,
                userId: true,
                digitalPhotoPriceCents: true,
              },
            }) as Record<string, unknown> | null;
            if (album) {
              (album as any).coverPhotoId = null;
              (album as any).hiddenPhotosEnabled = false;
              (album as any).hiddenSelfieRetentionDays = null;
              const photos = await prisma.photo.findMany({
                where: { albumId },
                select: { id: true, originalKey: true, previewUrl: true, userId: true, createdAt: true },
                orderBy: { createdAt: "desc" },
              });
              (album as any).photos = (photos as any[]).map((p: any) => ({ ...p, sellDigital: true, sellPrint: true }));
            }
          } else {
            throw fallbackErr;
          }
        }
      } else {
        throw dbErr;
      }
    }

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    if ((album as any).deletedAt) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (album.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado para acceder a este álbum" },
        { status: 403 }
      );
    }

    const isOwner = (album.userId as number) === user.id;
    (album as Record<string, unknown>).isOwner = isOwner;
    const photos = (album as any).photos as Array<{ id: number; userId?: number | null; previewUrl?: string; originalKey?: string }>;
    if (Array.isArray(photos)) {
      (album as any).photos = photos.map((p: { id: number; userId?: number | null; previewUrl?: string; originalKey?: string }) => {
        // Normalizar previewUrl para asegurar que sea una URL absoluta
        const normalizedUrl = normalizePreviewUrl(p.previewUrl, p.originalKey);
        
        // Log para debugging (solo en desarrollo)
        if (process.env.NODE_ENV === "development" && !normalizedUrl) {
          console.warn(`⚠️ No se pudo normalizar previewUrl para foto ${p.id}:`, {
            previewUrl: p.previewUrl,
            originalKey: p.originalKey,
          });
        }
        
        return {
          ...p,
          canDelete: p.userId === user.id || (p.userId == null && isOwner),
          previewUrl: normalizedUrl || p.previewUrl || null,
        };
      });
    }
    let photographerHandler = (album as any)?.user?.publicPageHandler ?? null;
    if (!photographerHandler && (album as any)?.userId) {
      try {
        const albumUser = await prisma.user.findUnique({
          where: { id: (album as any).userId },
          select: { publicPageHandler: true },
        });
        photographerHandler = albumUser?.publicPageHandler ?? null;
      } catch {}
    }
    return NextResponse.json({ ...album, photographerHandler });
  } catch (err: any) {
    console.error("GET /api/dashboard/albums/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar álbum
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Verificar que el álbum pertenece al fotógrafo y no está eliminado
    const existingAlbum = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true, deletedAt: true },
    });

    if (!existingAlbum) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    if (existingAlbum.deletedAt) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (existingAlbum.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado para editar este álbum" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, location, eventDate, albumProfitMarginPercent, digitalPhotoPriceCents, printPricingSource, hiddenPhotosEnabled, hiddenSelfieRetentionDays, preCompraCloseAt, requireClientApproval, schoolId, type } = body;

    const updateData: { [k: string]: unknown } = {};

    if (printPricingSource !== undefined) {
      const valid = printPricingSource === "PHOTOGRAPHER" || printPricingSource === "LAB_PREFERRED";
      updateData.printPricingSource = valid ? (printPricingSource as PrintPricingSource) : "PHOTOGRAPHER";
    }

    if (title !== undefined) {
      if (!title || typeof title !== "string" || !title.trim()) {
        return NextResponse.json(
          { error: "El título no puede estar vacío" },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (location !== undefined) {
      updateData.location = location?.trim() || null;
    }

    if (eventDate !== undefined) {
      if (eventDate) {
        const parsed = new Date(eventDate);
        updateData.eventDate = isNaN(parsed.getTime()) ? null : parsed;
      } else {
        updateData.eventDate = null;
      }
    }

    if (albumProfitMarginPercent !== undefined) {
      updateData.albumProfitMarginPercent = albumProfitMarginPercent
        ? parseFloat(String(albumProfitMarginPercent))
        : null;
    }

    if (digitalPhotoPriceCents !== undefined) {
      if (digitalPhotoPriceCents === null || digitalPhotoPriceCents === "") {
        updateData.digitalPhotoPriceCents = null;
      } else {
        const parsed = Math.round(Number(digitalPhotoPriceCents));
        if (!Number.isFinite(parsed) || parsed < 0) {
          updateData.digitalPhotoPriceCents = null;
        } else {
          const app = await prisma.appConfig.findUnique({ where: { id: 1 } });
          const min = app?.minDigitalPhotoPrice ?? 5000;
          if (parsed < min) {
            return NextResponse.json(
              { error: `El precio por foto digital no puede ser menor al mínimo del sistema (${min} pesos)` },
              { status: 400 }
            );
          }
          updateData.digitalPhotoPriceCents = parsed;
        }
      }
    }

    if (hiddenPhotosEnabled !== undefined) {
      updateData.hiddenPhotosEnabled = Boolean(hiddenPhotosEnabled);
    }
    if (hiddenSelfieRetentionDays !== undefined) {
      if (hiddenSelfieRetentionDays === null || hiddenSelfieRetentionDays === "") {
        updateData.hiddenSelfieRetentionDays = null;
      } else {
        const days = parseInt(String(hiddenSelfieRetentionDays), 10);
        updateData.hiddenSelfieRetentionDays = Number.isFinite(days) && days >= 0 ? days : null;
      }
    }

    if (preCompraCloseAt !== undefined) {
      if (preCompraCloseAt == null || preCompraCloseAt === "") {
        (updateData as any).preCompraCloseAt = null;
      } else {
        const d = new Date(preCompraCloseAt);
        (updateData as any).preCompraCloseAt = isNaN(d.getTime()) ? null : d;
      }
    }
    if (requireClientApproval !== undefined) {
      (updateData as any).requireClientApproval = Boolean(requireClientApproval);
    }

    if (schoolId !== undefined) {
      const sid = schoolId == null || schoolId === "" ? null : (Number.isFinite(Number(schoolId)) ? Number(schoolId) : null);
      if (sid != null) {
        const school = await prisma.school.findUnique({ where: { id: sid }, select: { ownerId: true } });
        if (!school || school.ownerId !== user.id) {
          return NextResponse.json({ error: "Escuela no encontrada o no te pertenece" }, { status: 400 });
        }
      }
      (updateData as any).schoolId = sid;
    }
    if (type !== undefined) {
      const validTypes = ["SCHOOL", "WEDDING", "BIRTHDAY", "GRADUATION", "SPORTS", "CONCERT", "CORPORATE", "OTHER", "PUBLIC_SESSION", "PRIVATE_SESSION", "PUBLIC_PHOTOGRAPHY", "THEMATIC_SESSIONS", "COMMERCIAL_SESSIONS", "RELIGIOUS", "FESTIVAL", "CONFERENCE"];
      (updateData as any).type = validTypes.includes(type) ? type : null;
    }

    const album = await prisma.album.update({
      where: { id: albumId },
      data: updateData,
      include: {
        photos: { select: { id: true } },
        preCompraProducts: { select: { id: true } },
      },
    });

    return NextResponse.json({
      ...album,
      photosCount: album.photos.length,
    });
  } catch (err: any) {
    console.error("PATCH /api/dashboard/albums/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// PUT: Actualizar álbum completo (incluye todos los campos nuevos)
export async function PUT(
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

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Verificar que el álbum pertenece al fotógrafo y no está eliminado
    const existingAlbum = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        userId: true,
        deletedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        enablePrintedPhotos: true,
        enableDigitalPhotos: true,
        selectedLabId: true,
        albumProfitMarginPercent: true,
        printPricingSource: true,
        digitalPhotoPriceCents: true,
        pickupBy: true,
        isPublic: true,
      },
    });

    if (!existingAlbum) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    if (existingAlbum.deletedAt) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (existingAlbum.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado para editar este álbum" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { 
      title, 
      location, 
      eventDate, 
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
      termsAccepted,
      digitalDiscount5Plus,
      digitalDiscount10Plus,
      digitalDiscount20Plus,
      hiddenPhotosEnabled,
      hiddenSelfieRetentionDays,
      preCompraCloseAt,
      requireClientApproval,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "El título es requerido" },
        { status: 400 }
      );
    }

    // Validar aceptación de términos si es necesario (permitir guardar sin habilitar)
    const needsTermsAcceptance = !existingAlbum.termsAcceptedAt || existingAlbum.termsVersion !== TERMS_VERSION;

    // Parsear precio digital (mínimo definido por configuración)
    let parsedDigital: number | null = null;
    if (digitalPhotoPriceCents !== null && digitalPhotoPriceCents !== undefined) {
      const parsed = Math.round(Number(digitalPhotoPriceCents));
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json(
          { error: "precio digital inválido" },
          { status: 400 }
        );
      }
      const app = await prisma.appConfig.findUnique({ where: { id: 1 } });
      const min = app?.minDigitalPhotoPrice ?? 5000;
      parsedDigital = parsed >= min ? parsed : null;
    }

    // Validar selectedLabId
    let parsedSelectedLabId: number | null = null;
    if (selectedLabId !== null && selectedLabId !== undefined) {
      parsedSelectedLabId = Number(selectedLabId);
      if (!Number.isFinite(parsedSelectedLabId) || parsedSelectedLabId <= 0) {
        return NextResponse.json({ error: "selectedLabId inválido" }, { status: 400 });
      }
      const labExists = await prisma.lab.findUnique({ where: { id: parsedSelectedLabId } });
      if (!labExists) {
        return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 400 });
      }
    }

    // Validar pickupBy
    const parsedPickupBy = (pickupBy === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : "CLIENT") as "CLIENT" | "PHOTOGRAPHER";

    // Parsear albumProfitMarginPercent (mínimo 0% para habilitar)
    let parsedMargin: number | null = null;
    if (albumProfitMarginPercent !== null && albumProfitMarginPercent !== undefined && albumProfitMarginPercent !== "") {
      parsedMargin = parseFloat(String(albumProfitMarginPercent));
      parsedMargin = Number.isFinite(parsedMargin) && parsedMargin >= 0 ? parsedMargin : null;
    }

    // Construir el objeto de datos
    const enablePrinted = enablePrintedPhotos !== undefined ? Boolean(enablePrintedPhotos) : Boolean(existingAlbum.enablePrintedPhotos);
    const enableDigital = enableDigitalPhotos !== undefined ? Boolean(enableDigitalPhotos) : Boolean(existingAlbum.enableDigitalPhotos);

    if (enablePrinted) {
      const hasProducts = await photographerHasActiveProducts(user.id);
      if (!hasProducts) {
        return NextResponse.json(
          { error: "Para habilitar impresas, primero cargá productos en tu lista de precios." },
          { status: 400 }
        );
      }
    }
    const parsedPrintPricingSource =
      printPricingSource === "LAB_PREFERRED" ? "LAB_PREFERRED" : "PHOTOGRAPHER";
    const parsedDigitalWithPrintDiscount = Number.isFinite(Number(digitalWithPrintDiscountPercent))
      ? Math.min(100, Math.max(0, Number(digitalWithPrintDiscountPercent)))
      : 0;

    const updateData: any = {
      title: title.trim(),
      location: location?.trim() || null,
      eventDate: eventDate ? new Date(eventDate) : null,
      albumProfitMarginPercent: parsedMargin,
      printPricingSource: parsedPrintPricingSource,
      digitalPhotoPriceCents: parsedDigital !== null
        ? parsedDigital
        : (digitalPhotoPriceCents === null ? null : existingAlbum.digitalPhotoPriceCents),
      enablePrintedPhotos: enablePrinted,
      enableDigitalPhotos: enableDigital,
      includeDigitalWithPrint: includeDigitalWithPrint !== undefined ? Boolean(includeDigitalWithPrint) : false,
      digitalWithPrintDiscountPercent: includeDigitalWithPrint ? parsedDigitalWithPrintDiscount : 0,
      allowClientLabSelection: false,
      showComingSoonMessage: showComingSoonMessage !== undefined ? Boolean(showComingSoonMessage) : false,
      isPublic: isPublic !== undefined ? Boolean(isPublic) : Boolean(existingAlbum.isPublic),
    };

    // Actualizar términos si fue aceptado
    if (needsTermsAcceptance && termsAccepted === true) {
      updateData.termsAcceptedAt = new Date();
      updateData.termsVersion = TERMS_VERSION;
    }

    // Actualizar descuentos por cantidad
    if (digitalDiscount5Plus !== undefined) {
      updateData.digitalDiscount5Plus = digitalDiscount5Plus !== null && digitalDiscount5Plus !== "" ? parseFloat(String(digitalDiscount5Plus)) : null;
    }
    if (digitalDiscount10Plus !== undefined) {
      updateData.digitalDiscount10Plus = digitalDiscount10Plus !== null && digitalDiscount10Plus !== "" ? parseFloat(String(digitalDiscount10Plus)) : null;
    }
    if (digitalDiscount20Plus !== undefined) {
      updateData.digitalDiscount20Plus = digitalDiscount20Plus !== null && digitalDiscount20Plus !== "" ? parseFloat(String(digitalDiscount20Plus)) : null;
    }

    if (parsedSelectedLabId !== null) {
      updateData.selectedLabId = parsedSelectedLabId;
      updateData.pickupBy = parsedPickupBy;
    } else {
      updateData.selectedLabId = null;
      // FASE 1: sin lab → impresión a cargo del fotógrafo. TODO FASE 2: allowClientLabSelection cuando selectedLabId != null
      updateData.pickupBy = enablePrinted ? "PHOTOGRAPHER" : parsedPickupBy;
    }

    if (hiddenPhotosEnabled !== undefined) {
      updateData.hiddenPhotosEnabled = Boolean(hiddenPhotosEnabled);
    }
    if (hiddenSelfieRetentionDays !== undefined) {
      if (hiddenSelfieRetentionDays === null || hiddenSelfieRetentionDays === "") {
        updateData.hiddenSelfieRetentionDays = null;
      } else {
        const days = parseInt(String(hiddenSelfieRetentionDays), 10);
        updateData.hiddenSelfieRetentionDays = Number.isFinite(days) && days >= 0 ? days : null;
      }
    }

    if (preCompraCloseAt !== undefined) {
      if (preCompraCloseAt == null || preCompraCloseAt === "") {
        (updateData as any).preCompraCloseAt = null;
      } else {
        const d = new Date(preCompraCloseAt);
        (updateData as any).preCompraCloseAt = isNaN(d.getTime()) ? null : d;
      }
    }
    if (requireClientApproval !== undefined) {
      (updateData as any).requireClientApproval = Boolean(requireClientApproval);
    }

    let album;
    let hiddenColumnsWarning: string | null = null;
    try {
      album = await prisma.album.update({
        where: { id: albumId },
        data: updateData,
        include: {
          photos: {
            select: {
              id: true,
            },
          },
        },
      });
    } catch (updateError: any) {
      const errorMsg = String(updateError?.message ?? updateError ?? "");
      const missingHiddenColumns = errorMsg.includes("hiddenPhotosEnabled") || errorMsg.includes("hiddenSelfieRetentionDays");
      // Si falla por columnas que no existen (migración no aplicada) o por otros campos, intentar sin esos campos
      if (missingHiddenColumns || errorMsg.includes("Unknown argument") || 
          errorMsg.includes("selectedLabId") || 
          errorMsg.includes("pickupBy") ||
          errorMsg.includes("enablePrintedPhotos") ||
          errorMsg.includes("enableDigitalPhotos") ||
        errorMsg.includes("includeDigitalWithPrint") ||
        errorMsg.includes("digitalWithPrintDiscountPercent") ||
          errorMsg.includes("showComingSoonMessage")) {
        if (missingHiddenColumns) {
          console.warn("Columnas hiddenPhotosEnabled/hiddenSelfieRetentionDays no existen. Ejecutá: npx prisma migrate deploy");
          hiddenColumnsWarning = "La opción \"Fotos ocultas hasta selfie\" no se guardó. En el servidor ejecutá: npx prisma migrate deploy";
        }
        console.warn(
          "Schema no actualizado, actualizando álbum sin campos nuevos. Staging/prod: ejecutar solo `pnpm --filter @repo/db run db:migrate:deploy`."
        );
        console.warn("Error original:", errorMsg);
        
        // Retry con SQL crudo para no pasar por el cliente Prisma (que usa el schema con hiddenPhotos*)
        const allowedKeys = [
          "title", "location", "eventDate", "albumProfitMarginPercent", "printPricingSource",
          "digitalPhotoPriceCents", "selectedLabId", "pickupBy", "enablePrintedPhotos",
          "enableDigitalPhotos", "includeDigitalWithPrint", "digitalWithPrintDiscountPercent",
          "allowClientLabSelection", "showComingSoonMessage", "isPublic",
          "termsAcceptedAt", "termsVersion", "digitalDiscount5Plus", "digitalDiscount10Plus", "digitalDiscount20Plus",
          ...(missingHiddenColumns ? [] : ["hiddenPhotosEnabled", "hiddenSelfieRetentionDays"]),
        ];
        const safeUpdateData: any = {};
        for (const key of allowedKeys) {
          if (Object.prototype.hasOwnProperty.call(updateData, key)) {
            safeUpdateData[key] = updateData[key];
          }
        }
        const setParts: Prisma.Sql[] = [];
        if (safeUpdateData.title !== undefined) setParts.push(Prisma.sql`"title" = ${safeUpdateData.title}`);
        if (safeUpdateData.location !== undefined) setParts.push(Prisma.sql`"location" = ${safeUpdateData.location}`);
        if (safeUpdateData.eventDate !== undefined) setParts.push(Prisma.sql`"eventDate" = ${safeUpdateData.eventDate}`);
        if (safeUpdateData.albumProfitMarginPercent !== undefined) setParts.push(Prisma.sql`"albumProfitMarginPercent" = ${safeUpdateData.albumProfitMarginPercent}`);
        if (safeUpdateData.printPricingSource !== undefined) setParts.push(Prisma.sql`"printPricingSource" = (${safeUpdateData.printPricingSource})::"PrintPricingSource"`);
        if (safeUpdateData.digitalPhotoPriceCents !== undefined) setParts.push(Prisma.sql`"digitalPhotoPriceCents" = ${safeUpdateData.digitalPhotoPriceCents}`);
        if (safeUpdateData.selectedLabId !== undefined) setParts.push(Prisma.sql`"selectedLabId" = ${safeUpdateData.selectedLabId}`);
        if (safeUpdateData.pickupBy !== undefined) setParts.push(Prisma.sql`"pickupBy" = (${safeUpdateData.pickupBy})::"PickupBy"`);
        if (safeUpdateData.enablePrintedPhotos !== undefined) setParts.push(Prisma.sql`"enablePrintedPhotos" = ${safeUpdateData.enablePrintedPhotos}`);
        if (safeUpdateData.enableDigitalPhotos !== undefined) setParts.push(Prisma.sql`"enableDigitalPhotos" = ${safeUpdateData.enableDigitalPhotos}`);
        if (safeUpdateData.includeDigitalWithPrint !== undefined) setParts.push(Prisma.sql`"includeDigitalWithPrint" = ${safeUpdateData.includeDigitalWithPrint}`);
        if (safeUpdateData.digitalWithPrintDiscountPercent !== undefined) setParts.push(Prisma.sql`"digitalWithPrintDiscountPercent" = ${safeUpdateData.digitalWithPrintDiscountPercent}`);
        if (safeUpdateData.allowClientLabSelection !== undefined) setParts.push(Prisma.sql`"allowClientLabSelection" = ${safeUpdateData.allowClientLabSelection}`);
        if (safeUpdateData.showComingSoonMessage !== undefined) setParts.push(Prisma.sql`"showComingSoonMessage" = ${safeUpdateData.showComingSoonMessage}`);
        if (safeUpdateData.isPublic !== undefined) setParts.push(Prisma.sql`"isPublic" = ${safeUpdateData.isPublic}`);
        if (safeUpdateData.termsAcceptedAt !== undefined) setParts.push(Prisma.sql`"termsAcceptedAt" = ${safeUpdateData.termsAcceptedAt}`);
        if (safeUpdateData.termsVersion !== undefined) setParts.push(Prisma.sql`"termsVersion" = ${safeUpdateData.termsVersion}`);
        if (safeUpdateData.digitalDiscount5Plus !== undefined) setParts.push(Prisma.sql`"digitalDiscount5Plus" = ${safeUpdateData.digitalDiscount5Plus}`);
        if (safeUpdateData.digitalDiscount10Plus !== undefined) setParts.push(Prisma.sql`"digitalDiscount10Plus" = ${safeUpdateData.digitalDiscount10Plus}`);
        if (safeUpdateData.digitalDiscount20Plus !== undefined) setParts.push(Prisma.sql`"digitalDiscount20Plus" = ${safeUpdateData.digitalDiscount20Plus}`);
        if (safeUpdateData.hiddenPhotosEnabled !== undefined) setParts.push(Prisma.sql`"hiddenPhotosEnabled" = ${safeUpdateData.hiddenPhotosEnabled}`);
        if (safeUpdateData.hiddenSelfieRetentionDays !== undefined) setParts.push(Prisma.sql`"hiddenSelfieRetentionDays" = ${safeUpdateData.hiddenSelfieRetentionDays}`);
        if (setParts.length > 0) {
          await prisma.$executeRaw(Prisma.sql`UPDATE "Album" SET ${Prisma.join(setParts, ", ")} WHERE "id" = ${albumId}`);
        }
        // Evitar findUnique (incluye columnas del schema que no existen en la DB); usar raw SELECT
        const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(
          Prisma.sql`SELECT * FROM "Album" WHERE "id" = ${albumId}`
        );
        const photoRows = await prisma.$queryRaw<Array<{ id: number }>>(
          Prisma.sql`SELECT "id" FROM "Photo" WHERE "albumId" = ${albumId}`
        );
        const row = rows[0];
        if (!row) {
          throw new Error("Álbum no encontrado tras actualización");
        }
        album = { ...row, photos: photoRows.map((p) => ({ id: p.id })) } as any;
      } else {
        console.error("PUT /api/dashboard/albums/[id] ERROR >>>", updateError);
        throw updateError;
      }
    }

    const payload: Record<string, unknown> = {
      ...album,
      photosCount: album.photos.length,
    };
    if (hiddenColumnsWarning) payload._warning = hiddenColumnsWarning;
    return NextResponse.json(payload);
  } catch (err: any) {
    const errorMessage = String(err?.message ?? err ?? "Error desconocido");
    console.error("PUT /api/dashboard/albums/[id] ERROR >>>", errorMessage);
    console.error("Stack:", err?.stack);
    return NextResponse.json(
      { 
        error: "Error actualizando álbum", 
        detail: errorMessage 
      },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar álbum (o solo mis fotos si es colaborativo)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Intentar obtener el álbum con photos, manejando el caso donde isRemoved no existe
    type AlbumWithPhotos = Prisma.AlbumGetPayload<{
      include: { photos: true };
    }>;
    
    let album: AlbumWithPhotos | null;
    try {
      album = await prisma.album.findUnique({
        where: { id: albumId },
        include: { photos: true },
      });
    } catch (err: any) {
      // Si falla por isRemoved u otro campo desconocido, intentar sin include y luego cargar photos por separado
      if (String(err?.message ?? "").includes("isRemoved") || String(err?.message ?? "").includes("Unknown field") || String(err?.message ?? "").includes("does not exist")) {
        const albumWithoutPhotos = await prisma.album.findUnique({
          where: { id: albumId },
        });
        if (albumWithoutPhotos) {
          // Cargar photos sin el campo isRemoved
          const photos = await prisma.photo.findMany({
            where: { albumId },
            select: {
              id: true,
              originalKey: true,
              previewUrl: true,
              userId: true,
              createdAt: true,
              sellDigital: true,
              sellPrint: true,
            },
          });
          album = {
            ...albumWithoutPhotos,
            photos: photos as Array<{ id: number; originalKey: string; previewUrl: string; userId: number | null; createdAt: Date; sellDigital: boolean; sellPrint: boolean }>,
          } as AlbumWithPhotos;
        } else {
          album = null;
        }
      } else {
        throw err;
      }
    }
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    if ((album as any).deletedAt) {
      return NextResponse.json({ error: "Este álbum ya fue eliminado" }, { status: 404 });
    }
    if (album.userId !== user.id) {
      return NextResponse.json({ error: "No autorizado para eliminar este álbum" }, { status: 403 });
    }

    const isOwner = album.userId === user.id;
    const myPhotos = album.photos.filter(
      (p) => p.userId === user.id || (p.userId == null && isOwner)
    );
    const otherPhotos = album.photos.filter(
      (p) => p.userId != null && p.userId !== user.id
    );

    const { deleteFromR2, urlToR2Key } = await import("@/lib/r2-client");

    const getPreviewKeyFromOriginalKey = (originalKey: string) => {
      const normalized = urlToR2Key(originalKey);
      if (normalized.includes("original_")) {
        return normalized.replace("original_", "preview_");
      }
      return normalized;
    };

    const deletePhotoFiles = async (photo: { originalKey: string }) => {
      try {
        // Eliminar preview
        const previewKey = getPreviewKeyFromOriginalKey(photo.originalKey);
        await deleteFromR2(previewKey).catch(() => {});
        
        // Eliminar original
        const originalKey = urlToR2Key(photo.originalKey);
        await deleteFromR2(originalKey).catch(() => {});
      } catch (error) {
        console.error(`Error eliminando archivos de R2 para ${photo.originalKey}:`, error);
        // Continuar aunque falle
      }
    };

    // Función helper para eliminar solicitudes de remoción asociadas a fotos
    const deleteRemovalRequestsForPhotos = async (photoIds: number[]) => {
      if (photoIds.length === 0) return;
      try {
        const prismaAny = prisma as any;
        if (prismaAny.removalRequest && typeof prismaAny.removalRequest.deleteMany === 'function') {
          await prismaAny.removalRequest.deleteMany({
            where: { photoId: { in: photoIds } },
          });
        } else {
          // Si el modelo no está disponible, usar SQL directo
          await prisma.$executeRaw`DELETE FROM "RemovalRequest" WHERE "photoId" = ANY(${photoIds})`;
        }
      } catch (err: any) {
        // Si falla, intentar con SQL raw como último recurso
        const errorMsg = String(err?.message ?? "");
        if (!errorMsg.includes("Unknown model") && !errorMsg.includes("Cannot read properties")) {
          try {
            await prisma.$executeRaw`DELETE FROM "RemovalRequest" WHERE "photoId" = ANY(${photoIds})`;
          } catch (sqlErr) {
            console.warn("No se pudieron eliminar las solicitudes de remoción:", sqlErr);
          }
        }
      }
    };

    if (otherPhotos.length === 0) {
      // Soft delete: marcar álbum como eliminado sin borrar pedidos ni contactos/interesados.
      // Las descargas asociadas al álbum quedarán inhabilitadas (se comprueba deletedAt en la API de descargas).
      await prisma.album.update({
        where: { id: albumId },
        data: {
          deletedAt: new Date(),
          isHidden: true,
        },
      });
      return NextResponse.json({ success: true, deleted: "album" });
    }

    // Eliminar solo las fotos del usuario
    const myIdsArray: number[] = myPhotos.map((p) => p.id);
    
    // Eliminar solicitudes de remoción primero
    await deleteRemovalRequestsForPhotos(myIdsArray);
    
    // Eliminar archivos físicos
    for (const p of myPhotos) await deletePhotoFiles(p);
    
    // Eliminar fotos de la base de datos
    try {
      await prisma.photo.deleteMany({ where: { id: { in: myIdsArray } } });
    } catch (deleteErr: any) {
      // Si aún falla por foreign key, intentar eliminar solicitudes nuevamente
      const errorMsg = String(deleteErr?.message ?? "");
      if (errorMsg.includes("RemovalRequest_photoId_fkey") || errorMsg.includes("Foreign key constraint")) {
        await deleteRemovalRequestsForPhotos(myIdsArray);
        await prisma.photo.deleteMany({ where: { id: { in: myIdsArray } } });
      } else {
        throw deleteErr;
      }
    }

    const remaining = otherPhotos;
    const needNewCover = album.coverPhotoId != null && myIdsArray.includes(album.coverPhotoId);
    const newCoverId = needNewCover && remaining.length > 0 ? remaining[0].id : null;

    const byUser = new Map<number, number>();
    for (const p of remaining) {
      const u = p.userId!;
      byUser.set(u, (byUser.get(u) ?? 0) + 1);
    }
    const newOwner = byUser.size > 0
      ? [...byUser.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

    await prisma.album.update({
      where: { id: albumId },
      data: {
        userId: newOwner ?? album.userId,
        coverPhotoId: newCoverId,
      },
    });
    return NextResponse.json({ success: true, deleted: "my_photos_only" });
  } catch (err: any) {
    console.error("DELETE /api/dashboard/albums/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
