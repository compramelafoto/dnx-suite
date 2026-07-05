import { prisma } from "@/lib/prisma";

const POLAROID_SIZES = ["7.5x10", "9x13", "10x15"];
const POLAROID_FINISHES = ["BRILLO", "MATE"];
const CARNET_NAMES = ["Fotos Carnet", "Foto Carnet"];
const POLAROID_NAMES = ["Polaroid", "Polaroids"];

async function ensureLabPrintProducts(labId: number, options: { carnet: boolean; polaroids: boolean }) {
  if (options.carnet) {
    const existing = await prisma.labProduct.findFirst({
      where: { labId, name: { in: CARNET_NAMES }, size: "10x15", acabado: "BRILLO" },
      select: { id: true },
    });
    if (!existing) {
      await prisma.labProduct.create({
        data: {
          labId,
          name: "Fotos Carnet",
          size: "10x15",
          acabado: "BRILLO",
          photographerPrice: 0,
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
        const existing = await prisma.labProduct.findFirst({
          where: { labId, name: { in: POLAROID_NAMES }, size, acabado },
          select: { id: true },
        });
        if (!existing) {
          await prisma.labProduct.create({
            data: {
              labId,
              name: "Polaroid",
              size,
              acabado,
              photographerPrice: 0,
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
import { NextRequest, NextResponse } from "next/server";
import { getR2PublicUrl } from "@/lib/r2-client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const labId = parseInt(id);

    if (isNaN(labId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    let lab: any;
    try {
      lab = await prisma.lab.findUnique({
        where: { id: labId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          province: true,
          country: true,
          latitude: true,
          longitude: true,
          isActive: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          tertiaryColor: true,
          fontColor: true,
          isPublicPageEnabled: true,
          publicPageHandler: true,
          showCarnetPrints: true,
          showPolaroidPrints: true,
          mpAccessToken: true,
          mpRefreshToken: true,
          mpUserId: true,
          mpConnectedAt: true,
          radiusKm: true,
          shippingEnabled: true,
          fulfillmentMode: true,
          defaultSlaDays: true,
          soyFotografo: true,
          usePriceForPhotographerOrders: true,
          user: {
            select: {
              website: true,
              instagram: true,
              facebook: true,
              whatsapp: true,
            },
          },
        },
      });
    } catch (err: any) {
      // Si falla por campos de MP, intentar sin ellos
      const errorMsg = String(err?.message ?? "");
      if (errorMsg.includes("mpAccessToken") || errorMsg.includes("mpRefreshToken") || errorMsg.includes("mpUserId") || errorMsg.includes("mpConnectedAt") || errorMsg.includes("Unknown field") || errorMsg.includes("latitude") || errorMsg.includes("longitude")) {
        lab = await prisma.lab.findUnique({
          where: { id: labId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            province: true,
            country: true,
            isActive: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            tertiaryColor: true,
            fontColor: true,
            isPublicPageEnabled: true,
            publicPageHandler: true,
            showCarnetPrints: true,
            showPolaroidPrints: true,
          },
        });
        if (lab) {
          lab.mpAccessToken = null;
          lab.mpRefreshToken = null;
          lab.mpUserId = null;
          lab.mpConnectedAt = null;
        }
      } else {
        throw err;
      }
    }

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Normalizar logoUrl para asegurar que sea una URL absoluta de R2
    if (lab.logoUrl && typeof lab.logoUrl === "string") {
      // Si es una URL relativa o localhost, construir desde la key
      if (!lab.logoUrl.startsWith("http") || lab.logoUrl.includes("localhost")) {
        // Intentar extraer la key de la URL o construir desde logoUrl
        const key = lab.logoUrl.replace(/^\//, "").replace(/^uploads\//, "uploads/");
        lab.logoUrl = getR2PublicUrl(key);
      }
    }

    return NextResponse.json(lab);
  } catch (error: any) {
    console.error("Error obteniendo laboratorio:", error);
    return NextResponse.json(
      { error: "Error obteniendo laboratorio", detail: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const labId = parseInt(id);

    if (isNaN(labId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      address,
      city,
      province,
      country,
      latitude,
      longitude,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      fontColor,
      isPublicPageEnabled,
      publicPageHandler,
      showCarnetPrints,
      showPolaroidPrints,
      radiusKm,
      shippingEnabled,
      fulfillmentMode,
      defaultSlaDays,
      soyFotografo,
      usePriceForPhotographerOrders,
    } = body;

    // Validar handler si se proporciona
    if (publicPageHandler) {
      const handlerRegex = /^[a-z0-9-]+$/;
      if (!handlerRegex.test(publicPageHandler)) {
        return NextResponse.json(
          { error: "El handler solo puede contener letras minúsculas, números y guiones" },
          { status: 400 }
        );
      }

      // Verificar unicidad del handler (excluyendo el lab actual)
      const existingLab = await prisma.lab.findFirst({
        where: {
          publicPageHandler: publicPageHandler.toLowerCase(),
          id: { not: labId },
        },
      });

      if (existingLab) {
        return NextResponse.json(
          { error: "El handler ya está en uso por otro laboratorio" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (province !== undefined) updateData.province = province?.trim() || null;
    if (country !== undefined) updateData.country = country?.trim() || null;
    if (latitude !== undefined) {
      const v = latitude === "" || latitude == null ? null : Number(latitude);
      updateData.latitude = v != null && Number.isFinite(v) ? v : null;
    }
    if (longitude !== undefined) {
      const v = longitude === "" || longitude == null ? null : Number(longitude);
      updateData.longitude = v != null && Number.isFinite(v) ? v : null;
    }
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor?.trim() || null;
    if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor?.trim() || null;
    if (tertiaryColor !== undefined) updateData.tertiaryColor = tertiaryColor?.trim() || null;
    if (fontColor !== undefined) updateData.fontColor = fontColor?.trim() || null;
    if (isPublicPageEnabled !== undefined) updateData.isPublicPageEnabled = isPublicPageEnabled;
    if (publicPageHandler !== undefined) {
      updateData.publicPageHandler = publicPageHandler?.trim()?.toLowerCase() || null;
    }
    if (showCarnetPrints !== undefined) updateData.showCarnetPrints = Boolean(showCarnetPrints);
    if (showPolaroidPrints !== undefined) updateData.showPolaroidPrints = Boolean(showPolaroidPrints);
    if (radiusKm !== undefined) updateData.radiusKm = radiusKm ? parseInt(String(radiusKm)) : null;
    if (shippingEnabled !== undefined) updateData.shippingEnabled = shippingEnabled;
    if (fulfillmentMode !== undefined) updateData.fulfillmentMode = fulfillmentMode;
    if (defaultSlaDays !== undefined) updateData.defaultSlaDays = defaultSlaDays ? parseInt(String(defaultSlaDays)) : null;
    if (soyFotografo !== undefined) updateData.soyFotografo = soyFotografo;
    if (usePriceForPhotographerOrders !== undefined && ["AUTO", "RETAIL", "WHOLESALE"].includes(usePriceForPhotographerOrders)) {
      updateData.usePriceForPhotographerOrders = usePriceForPhotographerOrders;
    }

    // Campos de Mercado Pago
    if (body.mpAccessToken !== undefined) updateData.mpAccessToken = body.mpAccessToken;
    if (body.mpRefreshToken !== undefined) updateData.mpRefreshToken = body.mpRefreshToken;
    if (body.mpUserId !== undefined) updateData.mpUserId = body.mpUserId;
    if (body.mpConnectedAt !== undefined) updateData.mpConnectedAt = body.mpConnectedAt ? new Date(body.mpConnectedAt) : null;

    // Obtener userId del lab para actualizar User también (redes sociales)
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { userId: true },
    });

    let updatedLab: any;
    try {
      updatedLab = await prisma.lab.update({
        where: { id: labId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          province: true,
          country: true,
          latitude: true,
          longitude: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          tertiaryColor: true,
          fontColor: true,
          isPublicPageEnabled: true,
          publicPageHandler: true,
          showCarnetPrints: true,
          showPolaroidPrints: true,
          mpAccessToken: true,
          mpRefreshToken: true,
          mpUserId: true,
          mpConnectedAt: true,
          radiusKm: true,
          shippingEnabled: true,
          fulfillmentMode: true,
          defaultSlaDays: true,
          soyFotografo: true,
          user: {
            select: {
              website: true,
              instagram: true,
              facebook: true,
              whatsapp: true,
            },
          },
        },
      });

      // Actualizar redes sociales en User si se proporcionaron
      if (lab?.userId && (body.website !== undefined || body.instagram !== undefined || body.facebook !== undefined || body.whatsapp !== undefined)) {
        const userUpdateData: any = {};
        if (body.website !== undefined) userUpdateData.website = body.website?.trim() || null;
        if (body.instagram !== undefined) userUpdateData.instagram = body.instagram?.trim() || null;
        if (body.facebook !== undefined) userUpdateData.facebook = body.facebook?.trim() || null;
        if (body.whatsapp !== undefined) userUpdateData.whatsapp = body.whatsapp?.trim() || null;

        await prisma.user.update({
          where: { id: lab.userId },
          data: userUpdateData,
        });

        // Actualizar en la respuesta
        updatedLab.user = await prisma.user.findUnique({
          where: { id: lab.userId },
          select: {
            website: true,
            instagram: true,
            facebook: true,
            whatsapp: true,
          },
        });
      }
    } catch (err: any) {
      // Si falla por campos de MP, intentar sin ellos
      const errorMsg = String(err?.message ?? "");
      if (errorMsg.includes("mpAccessToken") || errorMsg.includes("mpRefreshToken") || errorMsg.includes("mpUserId") || errorMsg.includes("mpConnectedAt") || errorMsg.includes("Unknown field")) {
        // Remover campos de MP del updateData si causan error
        const updateDataWithoutMP = { ...updateData };
        delete updateDataWithoutMP.mpAccessToken;
        delete updateDataWithoutMP.mpRefreshToken;
        delete updateDataWithoutMP.mpUserId;
        delete updateDataWithoutMP.mpConnectedAt;
        
        updatedLab = await prisma.lab.update({
          where: { id: labId },
          data: updateDataWithoutMP,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            province: true,
            country: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            tertiaryColor: true,
            fontColor: true,
            isPublicPageEnabled: true,
            publicPageHandler: true,
            showCarnetPrints: true,
            showPolaroidPrints: true,
            radiusKm: true,
            shippingEnabled: true,
            fulfillmentMode: true,
            defaultSlaDays: true,
            soyFotografo: true,
            user: {
              select: {
                website: true,
                instagram: true,
                facebook: true,
                whatsapp: true,
              },
            },
          },
        });
        if (updatedLab) {
          updatedLab.mpAccessToken = null;
          updatedLab.mpRefreshToken = null;
          updatedLab.mpUserId = null;
          updatedLab.mpConnectedAt = null;
        }
      } else {
        throw err;
      }
    }

    if (typeof updatedLab?.id === "number") {
      const shouldAddCarnet = showCarnetPrints === true;
      const shouldAddPolaroids = showPolaroidPrints === true;
      if (shouldAddCarnet || shouldAddPolaroids) {
        await ensureLabPrintProducts(updatedLab.id, {
          carnet: shouldAddCarnet,
          polaroids: shouldAddPolaroids,
        });
      }
    }

    return NextResponse.json(updatedLab);
  } catch (error: any) {
    console.error("Error actualizando laboratorio:", error);
    
    // Manejar errores específicos de Prisma
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "El handler ya está en uso por otro laboratorio" },
        { status: 400 }
      );
    }

    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    // Si hay campos faltantes en el schema
    if (error.message?.includes("Unknown arg") || error.message?.includes("does not exist")) {
      return NextResponse.json(
        {
          error: "Campos no encontrados en el schema. Ejecutá: npx prisma migrate dev --name add_lab_customization",
          detail: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Error actualizando laboratorio", detail: error.message },
      { status: 500 }
    );
  }
}
