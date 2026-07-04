import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const POLAROID_SIZES = ["7.5x10", "9x13", "10x15"];
const POLAROID_FINISHES = ["BRILLO", "MATE"];
const CARNET_NAMES = ["Fotos Carnet", "Foto Carnet"];
const POLAROID_NAMES = ["Polaroid", "Polaroids"];

async function ensurePhotographerPrintProducts(userId: number, options: { carnet: boolean; polaroids: boolean }) {
  if (options.carnet) {
    const existing = await prisma.photographerProduct.findFirst({
      where: { userId, name: { in: CARNET_NAMES }, size: "10x15", acabado: "BRILLO" },
      select: { id: true },
    });
    if (!existing) {
      await prisma.photographerProduct.create({
        data: {
          userId,
          name: "Fotos Carnet",
          size: "10x15",
          acabado: "BRILLO",
          retailPrice: 0,
          currency: "ARS",
          isActive: true,
        },
      });
    }
  }

  if (options.polaroids) {
    for (const size of POLAROID_SIZES) {
      for (const acabado of POLAROID_FINISHES) {
        const existing = await prisma.photographerProduct.findFirst({
          where: { userId, name: { in: POLAROID_NAMES }, size, acabado },
          select: { id: true },
        });
        if (!existing) {
          await prisma.photographerProduct.create({
            data: {
              userId,
              name: "Polaroid",
              size,
              acabado,
              retailPrice: 0,
              currency: "ARS",
              isActive: true,
            },
          });
        }
      }
    }
  }
}
import { getAppConfig } from "@/lib/services/settingsService";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const authUser = await getAuthUser();
    if (!authUser || (authUser.role !== Role.PHOTOGRAPHER && authUser.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const id = authUser.id;

    // Verificar que el usuario existe y es fotógrafo
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user || (user.role !== "PHOTOGRAPHER" && user.role !== "LAB_PHOTOGRAPHER")) {
      return NextResponse.json(
        { error: "Usuario no encontrado o no tiene rol válido" },
        { status: 404 }
      );
    }

    // Preparar datos para actualizar
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name?.toString().trim() || null;
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone?.toString().trim() || null;
    }

    if (body.city !== undefined) {
      updateData.city = body.city?.toString().trim() || null;
    }

    if (body.province !== undefined) {
      updateData.province = body.province?.toString().trim() || null;
    }

    if (body.country !== undefined) {
      updateData.country = body.country?.toString().trim() || null;
    }

    if (body.address !== undefined) {
      updateData.address = body.address?.toString().trim() || null;
    }

    if (body.latitude !== undefined) {
      const v = body.latitude === "" || body.latitude == null ? null : Number(body.latitude);
      updateData.latitude = v != null && Number.isFinite(v) ? v : null;
    }
    if (body.longitude !== undefined) {
      const v = body.longitude === "" || body.longitude == null ? null : Number(body.longitude);
      updateData.longitude = v != null && Number.isFinite(v) ? v : null;
    }

    if (body.birthDate !== undefined) {
      updateData.birthDate = body.birthDate ? new Date(body.birthDate) : null;
    }

    if (body.companyName !== undefined) {
      updateData.companyName = body.companyName?.toString().trim() || null;
    }

    if (body.companyOwner !== undefined) {
      updateData.companyOwner = body.companyOwner?.toString().trim() || null;
    }

    if (body.cuit !== undefined) {
      updateData.cuit = body.cuit?.toString().trim() || null;
    }

    if (body.logoUrl !== undefined) {
      updateData.logoUrl = body.logoUrl?.toString().trim() || null;
    }

    if (body.primaryColor !== undefined) {
      const color = body.primaryColor?.toString().trim();
      // Validar formato hex
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.primaryColor = color;
      } else if (color === "" || color === null) {
        updateData.primaryColor = null;
      }
    }

    if (body.secondaryColor !== undefined) {
      const color = body.secondaryColor?.toString().trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.secondaryColor = color;
      } else if (color === "" || color === null) {
        updateData.secondaryColor = null;
      }
    }

    if (body.tertiaryColor !== undefined) {
      const color = body.tertiaryColor?.toString().trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.tertiaryColor = color;
      } else if (color === "" || color === null) {
        updateData.tertiaryColor = null;
      }
    }

    if (body.fontColor !== undefined) {
      const color = body.fontColor?.toString().trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.fontColor = color;
      } else if (color === "" || color === null) {
        updateData.fontColor = null;
      }
    }

    if (body.headerBackgroundColor !== undefined) {
      const color = body.headerBackgroundColor?.toString().trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.headerBackgroundColor = color;
      } else if (color === "" || color === null) {
        updateData.headerBackgroundColor = null;
      }
    }
    if (body.footerBackgroundColor !== undefined) {
      const color = body.footerBackgroundColor?.toString().trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.footerBackgroundColor = color;
      } else if (color === "" || color === null) {
        updateData.footerBackgroundColor = null;
      }
    }
    if (body.heroBackgroundColor !== undefined) {
      const color = body.heroBackgroundColor?.toString().trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.heroBackgroundColor = color;
      } else if (color === "" || color === null) {
        updateData.heroBackgroundColor = null;
      }
    }
    if (body.pageBackgroundColor !== undefined) {
      const color = body.pageBackgroundColor?.toString().trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        updateData.pageBackgroundColor = color;
      } else if (color === "" || color === null) {
        updateData.pageBackgroundColor = null;
      }
    }

    if (body.preferredLabId !== undefined) {
      const labId = body.preferredLabId ? Number(body.preferredLabId) : null;
      if (labId && Number.isFinite(labId)) {
        // Verificar que el lab existe
        const lab = await prisma.lab.findUnique({
          where: { id: labId },
        });
        if (lab) {
          updateData.preferredLabId = labId;
        }
      } else {
        updateData.preferredLabId = null;
      }
    }

    if (body.profitMarginPercent !== undefined) {
      const margin = body.profitMarginPercent ? Number(body.profitMarginPercent) : null;
      if (margin !== null && Number.isFinite(margin) && margin >= 0 && margin <= 100) {
        updateData.profitMarginPercent = margin;
      } else if (margin === null) {
        updateData.profitMarginPercent = null;
      }
    }

    if (body.defaultDigitalPhotoPrice !== undefined) {
      const config = await getAppConfig();
      const minPrice = config?.minDigitalPhotoPrice ?? 5000;
      const price = body.defaultDigitalPhotoPrice ? Number(body.defaultDigitalPhotoPrice) : null;
      if (price !== null && Number.isFinite(price) && price >= 0) {
        if (price < minPrice) {
          return NextResponse.json(
            { error: `El precio por foto digital no puede ser menor al mínimo del sistema (${minPrice} pesos)` },
            { status: 400 }
          );
        }
        updateData.defaultDigitalPhotoPrice = price;
      } else {
        // Que el valor no quede nulo: usar siempre el mínimo de la plataforma como valor por defecto
        updateData.defaultDigitalPhotoPrice = minPrice;
      }
    }

    if (body.digitalDiscountsEnabled !== undefined) {
      updateData.digitalDiscountsEnabled = Boolean(body.digitalDiscountsEnabled);
    }

    if (body.digitalDiscount5Plus !== undefined) {
      const discount = body.digitalDiscount5Plus ? Number(body.digitalDiscount5Plus) : null;
      if (discount !== null && Number.isFinite(discount) && discount >= 0 && discount <= 100) {
        updateData.digitalDiscount5Plus = discount;
      } else {
        updateData.digitalDiscount5Plus = null;
      }
    }

    if (body.digitalDiscount10Plus !== undefined) {
      const discount = body.digitalDiscount10Plus ? Number(body.digitalDiscount10Plus) : null;
      if (discount !== null && Number.isFinite(discount) && discount >= 0 && discount <= 100) {
        updateData.digitalDiscount10Plus = discount;
      } else {
        updateData.digitalDiscount10Plus = null;
      }
    }

    if (body.digitalDiscount20Plus !== undefined) {
      const discount = body.digitalDiscount20Plus ? Number(body.digitalDiscount20Plus) : null;
      if (discount !== null && Number.isFinite(discount) && discount >= 0 && discount <= 100) {
        updateData.digitalDiscount20Plus = discount;
      } else {
        updateData.digitalDiscount20Plus = null;
      }
    }

    if (body.isPublicPageEnabled !== undefined) {
      updateData.isPublicPageEnabled = Boolean(body.isPublicPageEnabled);
    }

    if (body.publicPageHandler !== undefined) {
      const handler = body.publicPageHandler?.toString().trim().toLowerCase() || null;
      if (handler) {
        // Validar formato del handler (solo letras, números, guiones)
        if (!/^[a-z0-9-]+$/.test(handler)) {
          return NextResponse.json(
            { error: "El handler solo puede contener letras, números y guiones" },
            { status: 400 }
          );
        }
        // Verificar que no esté en uso por otro usuario
        let existing: any = null;
        try {
          existing = await prisma.user.findFirst({
            where: {
              publicPageHandler: handler,
              id: { not: id },
            },
            select: {
              id: true,
              publicPageHandler: true,
            },
          });
        } catch (err: any) {
          // Si falla por campos desconocidos, intentar con select mínimo
          if (String(err?.message ?? "").includes("defaultDigitalPhotoPrice") || String(err?.message ?? "").includes("does not exist") || String(err?.message ?? "").includes("Unknown column")) {
            try {
              existing = await prisma.user.findFirst({
                where: {
                  publicPageHandler: handler,
                  id: { not: id },
                },
                select: {
                  id: true,
                },
              });
            } catch (fallbackErr) {
              // Si aún falla, simplemente no verificar (no crítico)
              console.warn("No se pudo verificar handler duplicado:", fallbackErr);
            }
          } else {
            throw err;
          }
        }
        if (existing) {
          return NextResponse.json(
            { error: "Este handler ya está en uso" },
            { status: 400 }
          );
        }
        updateData.publicPageHandler = handler;
      } else {
        updateData.publicPageHandler = null;
      }
    }

    // Intentar agregar los nuevos campos si están presentes
    try {
      if (body.enableAlbumsPage !== undefined) {
        updateData.enableAlbumsPage = Boolean(body.enableAlbumsPage);
      }

      if (body.enablePrintPage !== undefined) {
        updateData.enablePrintPage = Boolean(body.enablePrintPage);
      }
      if (body.showCarnetPrints !== undefined) {
        updateData.showCarnetPrints = Boolean(body.showCarnetPrints);
      }
      if (body.showPolaroidPrints !== undefined) {
        updateData.showPolaroidPrints = Boolean(body.showPolaroidPrints);
      }
    } catch (err: any) {
      // Si los campos no existen, simplemente no los agregamos
      const errorMsg = String(err?.message ?? "");
      if (
        !errorMsg.includes("enableAlbumsPage") &&
        !errorMsg.includes("enablePrintPage") &&
        !errorMsg.includes("showCarnetPrints") &&
        !errorMsg.includes("showPolaroidPrints")
      ) {
        throw err;
      }
    }

    // Intentar agregar campos de redes sociales si están presentes
    try {
      if (body.companyAddress !== undefined) {
        updateData.companyAddress = body.companyAddress?.toString().trim() || null;
      }
      if (body.website !== undefined) {
        updateData.website = body.website?.toString().trim() || null;
      }
      if (body.instagram !== undefined) {
        updateData.instagram = body.instagram?.toString().trim() || null;
      }
      if (body.tiktok !== undefined) {
        updateData.tiktok = body.tiktok?.toString().trim() || null;
      }
      if (body.facebook !== undefined) {
        updateData.facebook = body.facebook?.toString().trim() || null;
      }
      if (body.whatsapp !== undefined) {
        updateData.whatsapp = body.whatsapp?.toString().trim() || null;
      }
    } catch (err: any) {
      // Si los campos no existen, simplemente no los agregamos
      const errorMsg = String(err?.message ?? "");
      if (!errorMsg.includes("companyAddress") && !errorMsg.includes("website") && !errorMsg.includes("instagram") && !errorMsg.includes("tiktok") && !errorMsg.includes("facebook") && !errorMsg.includes("whatsapp")) {
        // Solo ignorar si es específicamente sobre estos campos
      }
    }

    // Campos de Mercado Pago
    if (body.mpAccessToken !== undefined) updateData.mpAccessToken = body.mpAccessToken;
    if (body.mpRefreshToken !== undefined) updateData.mpRefreshToken = body.mpRefreshToken;
    if (body.mpUserId !== undefined) updateData.mpUserId = body.mpUserId;
    if (body.mpConnectedAt !== undefined) updateData.mpConnectedAt = body.mpConnectedAt ? new Date(body.mpConnectedAt) : null;

    // Verificar que hay datos para actualizar
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No hay datos para actualizar" },
        { status: 400 }
      );
    }

    console.log("Actualizando usuario:", id, "con datos:", updateData);

    // Actualizar usuario con manejo de errores para campos que pueden no existir
    let updated: any;
    try {
      // Intentar con todos los campos primero
      updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          city: true,
          province: true,
          country: true,
          address: true,
          birthDate: true,
          companyName: true,
          companyOwner: true,
          cuit: true,
          role: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          fontColor: true,
          preferredLabId: true,
          profitMarginPercent: true,
          isPublicPageEnabled: true,
          publicPageHandler: true,
          preferredLab: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      // Intentar agregar campos opcionales si existen
      try {
        const fullUser = await prisma.user.findUnique({
          where: { id },
          select: {
            companyAddress: true,
            website: true,
            instagram: true,
            tiktok: true,
            facebook: true,
            whatsapp: true,
            tertiaryColor: true,
            fontColor: true,
            headerBackgroundColor: true,
            footerBackgroundColor: true,
            heroBackgroundColor: true,
            pageBackgroundColor: true,
            enableAlbumsPage: true,
            enablePrintPage: true,
            showCarnetPrints: true,
            showPolaroidPrints: true,
            mpAccessToken: true,
            mpRefreshToken: true,
            mpUserId: true,
            mpConnectedAt: true,
          },
        });
        if (fullUser) {
          updated = { ...updated, ...fullUser };
        }
      } catch (e) {
        // Si los campos no existen, usar valores por defecto
        updated.companyAddress = null;
        updated.website = null;
        updated.instagram = null;
        updated.tiktok = null;
        updated.facebook = null;
        updated.whatsapp = null;
        updated.tertiaryColor = null;
        updated.fontColor = null;
        updated.headerBackgroundColor = null;
        updated.footerBackgroundColor = null;
        updated.heroBackgroundColor = null;
        updated.pageBackgroundColor = null;
        updated.enableAlbumsPage = false;
        updated.enablePrintPage = false;
        updated.showCarnetPrints = false;
        updated.showPolaroidPrints = false;
      }
    } catch (updateErr: any) {
      const errorMsg = String(updateErr?.message ?? "");
      
      // Si falla por campos desconocidos, intentar sin ellos
      if (errorMsg.includes("enableAlbumsPage") || errorMsg.includes("enablePrintPage") || errorMsg.includes("showCarnetPrints") || errorMsg.includes("showPolaroidPrints") || errorMsg.includes("tertiaryColor") || errorMsg.includes("fontColor") || errorMsg.includes("headerBackgroundColor") || errorMsg.includes("footerBackgroundColor") || errorMsg.includes("heroBackgroundColor") || errorMsg.includes("pageBackgroundColor") || errorMsg.includes("companyAddress") || errorMsg.includes("website") || errorMsg.includes("instagram") || errorMsg.includes("tiktok") || errorMsg.includes("facebook") || errorMsg.includes("whatsapp") || errorMsg.includes("defaultDigitalPhotoPrice") || errorMsg.includes("digitalDiscountsEnabled") || errorMsg.includes("digitalDiscount5Plus") || errorMsg.includes("digitalDiscount10Plus") || errorMsg.includes("digitalDiscount20Plus") || errorMsg.includes("Unknown field") || errorMsg.includes("Unknown argument") || errorMsg.includes("does not exist")) {
        console.warn(
          "PATCH /api/fotografo/update: algunos campos no existen. Staging/prod: ejecutar solo `pnpm --filter @repo/db run db:migrate:deploy`."
        );
        
        // Remover campos que pueden no existir del updateData
        const safeUpdateData: any = { ...updateData };
        delete safeUpdateData.defaultDigitalPhotoPrice;
        delete safeUpdateData.digitalDiscountsEnabled;
        delete safeUpdateData.digitalDiscount5Plus;
        delete safeUpdateData.digitalDiscount10Plus;
        delete safeUpdateData.digitalDiscount20Plus;
        delete safeUpdateData.enableAlbumsPage;
        delete safeUpdateData.enablePrintPage;
        delete safeUpdateData.showCarnetPrints;
        delete safeUpdateData.showPolaroidPrints;
        delete safeUpdateData.tertiaryColor;
        delete safeUpdateData.fontColor;
        delete safeUpdateData.headerBackgroundColor;
        delete safeUpdateData.footerBackgroundColor;
        delete safeUpdateData.heroBackgroundColor;
        delete safeUpdateData.pageBackgroundColor;
        delete safeUpdateData.companyAddress;
        delete safeUpdateData.website;
        delete safeUpdateData.instagram;
        delete safeUpdateData.tiktok;
        delete safeUpdateData.facebook;
        delete safeUpdateData.whatsapp;
        
        // Actualizar sin los campos nuevos
        updated = await prisma.user.update({
          where: { id },
          data: safeUpdateData,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            city: true,
            province: true,
            country: true,
            address: true,
            birthDate: true,
            companyName: true,
            companyOwner: true,
            cuit: true,
            role: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            preferredLabId: true,
            profitMarginPercent: true,
            isPublicPageEnabled: true,
            publicPageHandler: true,
            preferredLab: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });
        
        // Agregar valores por defecto si no existen
        updated.enableAlbumsPage = false;
        updated.enablePrintPage = false;
        updated.tertiaryColor = null;
        updated.fontColor = null;
        updated.headerBackgroundColor = null;
        updated.footerBackgroundColor = null;
        updated.heroBackgroundColor = null;
        updated.pageBackgroundColor = null;
        updated.companyAddress = null;
        updated.website = null;
        updated.instagram = null;
        updated.tiktok = null;
        updated.facebook = null;
        updated.whatsapp = null;
        updated.defaultDigitalPhotoPrice = null;
        updated.digitalDiscountsEnabled = false;
        updated.digitalDiscount5Plus = null;
        updated.digitalDiscount10Plus = null;
        updated.digitalDiscount20Plus = null;
      } else {
        throw updateErr;
      }
    }

    if (typeof updated?.id === "number") {
      const shouldAddCarnet = body.showCarnetPrints === true;
      const shouldAddPolaroids = body.showPolaroidPrints === true;
      if (shouldAddCarnet || shouldAddPolaroids) {
        await ensurePhotographerPrintProducts(updated.id, {
          carnet: shouldAddCarnet,
          polaroids: shouldAddPolaroids,
        });
      }
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/fotografo/update ERROR >>>", err);
    
    // Si el error es de Prisma sobre campos que no existen, sugerir migración
    if (err?.message?.includes("Unknown argument") || err?.message?.includes("Unknown field")) {
      return NextResponse.json(
        { 
          error:
            "Error: Los campos de personalización no existen en la base de datos. En staging/prod ejecutá solo `pnpm --filter @repo/db run db:migrate:deploy`.",
          detail: err?.message 
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Error actualizando datos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
