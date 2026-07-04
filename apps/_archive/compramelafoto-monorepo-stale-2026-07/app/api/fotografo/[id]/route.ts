import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(ctx.params);
    const id = Number(params.id);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    let user: any;
    
    try {
      // Intentar con los nuevos campos primero
      // Usamos un tipo más flexible para evitar errores de TypeScript si el cliente de Prisma no está completamente actualizado
      const selectFields: any = {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        city: true,
        province: true,
        country: true,
        address: true,
        latitude: true,
        longitude: true,
        birthDate: true,
        companyName: true,
        companyOwner: true,
        cuit: true,
        companyAddress: true,
        website: true,
        instagram: true,
        tiktok: true,
        facebook: true,
        whatsapp: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        tertiaryColor: true,
        fontColor: true,
        headerBackgroundColor: true,
        footerBackgroundColor: true,
        heroBackgroundColor: true,
        pageBackgroundColor: true,
        preferredLabId: true,
        profitMarginPercent: true,
        defaultDigitalPhotoPrice: true,
        isPublicPageEnabled: true,
        publicPageHandler: true,
        enableAlbumsPage: true,
        enablePrintPage: true,
        mpAccessToken: true,
        mpRefreshToken: true,
        mpUserId: true,
        mpConnectedAt: true,
        marketingOptIn: true,
        preferredLab: {
          select: {
            id: true,
            name: true,
          },
        },
      };
      
      user = await prisma.user.findUnique({
        where: { id },
        select: selectFields,
      });
    } catch (err: any) {
      // Si falla por campos desconocidos, intentar sin ellos
      const errorMsg = String(err?.message ?? "");
      if (errorMsg.includes("enableAlbumsPage") || errorMsg.includes("enablePrintPage") || errorMsg.includes("tertiaryColor") || errorMsg.includes("fontColor") || errorMsg.includes("headerBackgroundColor") || errorMsg.includes("footerBackgroundColor") || errorMsg.includes("heroBackgroundColor") || errorMsg.includes("pageBackgroundColor") || errorMsg.includes("website") || errorMsg.includes("instagram") || errorMsg.includes("tiktok") || errorMsg.includes("facebook") || errorMsg.includes("whatsapp") || errorMsg.includes("companyAddress") || errorMsg.includes("Unknown field")) {
        console.warn("GET /api/fotografo/[id]: algunos campos no existen. Ejecutá: npx prisma db push && npx prisma generate");
        user = await prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            phone: true,
            city: true,
            province: true,
            country: true,
            address: true,
            latitude: true,
            longitude: true,
            birthDate: true,
            companyName: true,
            companyOwner: true,
            cuit: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            preferredLabId: true,
            profitMarginPercent: true,
            defaultDigitalPhotoPrice: true,
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
        if (user) {
          user.enableAlbumsPage = false;
          user.enablePrintPage = false;
          user.tertiaryColor = null;
          user.fontColor = null;
          user.headerBackgroundColor = null;
          user.footerBackgroundColor = null;
          user.heroBackgroundColor = null;
          user.pageBackgroundColor = null;
          user.website = null;
          user.instagram = null;
          user.tiktok = null;
          user.facebook = null;
          user.whatsapp = null;
          user.companyAddress = null;
        }
      } else {
        throw err;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Que el precio por defecto de foto digital no quede nulo: usar mínimo de la plataforma
    const config = await getAppConfig();
    const platformMinDigital = config?.minDigitalPhotoPrice ?? 5000;
    if (user.defaultDigitalPhotoPrice == null) {
      user.defaultDigitalPhotoPrice = platformMinDigital;
    }

    return NextResponse.json(user, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/fotografo/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
