import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);

    if (error || !user) {
      // Si el error es específicamente de rol, devolver 403 en lugar de 401
      if (error?.includes("rol ADMIN") || error?.includes("No autorizado")) {
        return NextResponse.json(
          { error: error || "No autorizado. Se requiere rol ADMIN." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    // Obtener o crear configuración (id siempre es 1)
    let config: any = null;
    
    try {
      config = await prisma.appConfig.findUnique({
        where: { id: 1 },
      });
    } catch (err: any) {
      // Si falla porque faltan columnas, intentar obtener solo los campos básicos
      if (err?.code === "P2022" || err?.message?.includes("does not exist")) {
        console.warn("Algunas columnas no existen en AppConfig, obteniendo campos básicos");
        try {
          const basicConfig = await prisma.$queryRaw`
            SELECT id, "minDigitalPhotoPrice", "platformCommissionPercent", 
                   "stuckOrderDays", "downloadLinkDays", "photoDeletionDays", 
                   "maintenanceMode", "updatedAt"
            FROM "AppConfig" 
            WHERE id = 1
          ` as any[];
          
          if (basicConfig && basicConfig.length > 0) {
            config = {
              ...basicConfig[0],
              // Agregar valores por defecto para campos que no existen
              commissionPublicTypeA_Bps: 750,
              commissionPublicTypeB_Bps: 1000,
              commissionDigital_Bps: 1000,
              commissionPro_Bps: null,
            };
          }
        } catch (rawErr) {
          console.error("Error obteniendo configuración básica:", rawErr);
        }
      } else {
        throw err;
      }
    }

    // Si no existe, crear con valores por defecto (solo campos básicos)
    if (!config) {
      try {
        config = await prisma.appConfig.create({
          data: {
            id: 1,
            minDigitalPhotoPrice: 5000,
            platformCommissionPercent: 10,
            stuckOrderDays: 7,
            downloadLinkDays: 30,
            photoDeletionDays: 45,
            maintenanceMode: false,
          },
        });
        // Agregar valores por defecto para campos nuevos
        config = {
          ...config,
          commissionPublicTypeA_Bps: 750,
          commissionPublicTypeB_Bps: 1000,
          commissionDigital_Bps: 1000,
          commissionPro_Bps: null,
        };
      } catch (createErr: any) {
        // Si falla la creación, retornar valores por defecto
        console.warn("No se pudo crear AppConfig, retornando valores por defecto:", createErr);
        config = {
          id: 1,
        minDigitalPhotoPrice: 5000,
          platformCommissionPercent: 10,
          commissionPublicTypeA_Bps: 750,
          commissionPublicTypeB_Bps: 1000,
          commissionDigital_Bps: 1000,
          commissionPro_Bps: null,
          stuckOrderDays: 7,
          downloadLinkDays: 30,
          photoDeletionDays: 45,
          maintenanceMode: false,
        };
      }
    } else {
      // Asegurar que los campos nuevos tengan valores por defecto si no existen
      config = {
        ...config,
        commissionPublicTypeA_Bps: config.commissionPublicTypeA_Bps ?? 750,
        commissionPublicTypeB_Bps: config.commissionPublicTypeB_Bps ?? 1000,
        commissionDigital_Bps: config.commissionDigital_Bps ?? 1000,
        commissionPro_Bps: config.commissionPro_Bps ?? null,
      };
    }

    return NextResponse.json(config);
  } catch (err: any) {
    console.error("GET /api/admin/config ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo configuración", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      minDigitalPhotoPrice,
      platformCommissionPercent,
      commissionPublicTypeA_Bps,
      commissionPublicTypeB_Bps,
      commissionDigital_Bps,
      commissionPro_Bps,
      stuckOrderDays,
      downloadLinkDays,
      photoDeletionDays,
      maintenanceMode,
      whatsappEnabled,
      whatsappMaxPhotosToSend,
      whatsappSendInitialMessage,
      whatsappSendFinalMessage,
      whatsappSendDownloadLinkForLargeOrders,
      whatsappDeliveryEnabledForPaidOrders,
    } = body;

    const updateData: any = {};

    if (minDigitalPhotoPrice !== undefined) {
      const price = parseInt(String(minDigitalPhotoPrice));
      if (isNaN(price) || price < 0) {
        return NextResponse.json(
          { error: "minDigitalPhotoPrice debe ser un número positivo" },
          { status: 400 }
        );
      }
      updateData.minDigitalPhotoPrice = price;
    }

    if (platformCommissionPercent !== undefined) {
      const percent = parseInt(String(platformCommissionPercent));
      if (isNaN(percent) || percent < 0 || percent > 100) {
        return NextResponse.json(
          { error: "platformCommissionPercent debe ser un número entre 0 y 100" },
          { status: 400 }
        );
      }
      updateData.platformCommissionPercent = percent;
    }

    // Nuevos campos de comisiones en basis points
    if (commissionPublicTypeA_Bps !== undefined) {
      const bps = parseInt(String(commissionPublicTypeA_Bps));
      if (isNaN(bps) || bps < 0 || bps > 10000) {
        return NextResponse.json(
          { error: "commissionPublicTypeA_Bps debe ser un número entre 0 y 10000" },
          { status: 400 }
        );
      }
      updateData.commissionPublicTypeA_Bps = bps;
    }

    if (commissionPublicTypeB_Bps !== undefined) {
      const bps = parseInt(String(commissionPublicTypeB_Bps));
      if (isNaN(bps) || bps < 0 || bps > 10000) {
        return NextResponse.json(
          { error: "commissionPublicTypeB_Bps debe ser un número entre 0 y 10000" },
          { status: 400 }
        );
      }
      updateData.commissionPublicTypeB_Bps = bps;
    }

    if (commissionDigital_Bps !== undefined) {
      const bps = parseInt(String(commissionDigital_Bps));
      if (isNaN(bps) || bps < 0 || bps > 10000) {
        return NextResponse.json(
          { error: "commissionDigital_Bps debe ser un número entre 0 y 10000" },
          { status: 400 }
        );
      }
      updateData.commissionDigital_Bps = bps;
    }

    if (commissionPro_Bps !== undefined) {
      if (commissionPro_Bps === null || commissionPro_Bps === "") {
        updateData.commissionPro_Bps = null;
      } else {
        const bps = parseInt(String(commissionPro_Bps));
        if (isNaN(bps) || bps < 0 || bps > 10000) {
          return NextResponse.json(
            { error: "commissionPro_Bps debe ser un número entre 0 y 10000 o null" },
            { status: 400 }
          );
        }
        updateData.commissionPro_Bps = bps;
      }
    }

    // Configuraciones generales
    if (stuckOrderDays !== undefined) {
      const days = parseInt(String(stuckOrderDays));
      if (isNaN(days) || days < 1) {
        return NextResponse.json(
          { error: "stuckOrderDays debe ser un número mayor a 0" },
          { status: 400 }
        );
      }
      updateData.stuckOrderDays = days;
    }

    if (downloadLinkDays !== undefined) {
      const days = parseInt(String(downloadLinkDays));
      if (isNaN(days) || days < 1) {
        return NextResponse.json(
          { error: "downloadLinkDays debe ser un número mayor a 0" },
          { status: 400 }
        );
      }
      updateData.downloadLinkDays = days;
    }

    if (photoDeletionDays !== undefined) {
      const days = parseInt(String(photoDeletionDays));
      if (isNaN(days) || days < 1) {
        return NextResponse.json(
          { error: "photoDeletionDays debe ser un número mayor a 0" },
          { status: 400 }
        );
      }
      updateData.photoDeletionDays = days;
    }

    if (maintenanceMode !== undefined) {
      updateData.maintenanceMode = Boolean(maintenanceMode);
    }

    // WhatsApp entrega post-compra
    if (whatsappEnabled !== undefined) updateData.whatsappEnabled = Boolean(whatsappEnabled);
    if (whatsappMaxPhotosToSend !== undefined) {
      const n = parseInt(String(whatsappMaxPhotosToSend));
      if (!isNaN(n) && n >= 1 && n <= 50) updateData.whatsappMaxPhotosToSend = n;
    }
    if (whatsappSendInitialMessage !== undefined) updateData.whatsappSendInitialMessage = Boolean(whatsappSendInitialMessage);
    if (whatsappSendFinalMessage !== undefined) updateData.whatsappSendFinalMessage = Boolean(whatsappSendFinalMessage);
    if (whatsappSendDownloadLinkForLargeOrders !== undefined) updateData.whatsappSendDownloadLinkForLargeOrders = Boolean(whatsappSendDownloadLinkForLargeOrders);
    if (whatsappDeliveryEnabledForPaidOrders !== undefined) updateData.whatsappDeliveryEnabledForPaidOrders = Boolean(whatsappDeliveryEnabledForPaidOrders);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No hay datos para actualizar" },
        { status: 400 }
      );
    }

    // Obtener configuración actual para auditoría
    const currentConfig = await prisma.appConfig.findUnique({
      where: { id: 1 },
    }).catch(() => null);

    // Actualizar o crear configuración
    const config = await prisma.appConfig.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        minDigitalPhotoPrice: updateData.minDigitalPhotoPrice ?? 5000,
        platformCommissionPercent: updateData.platformCommissionPercent ?? 10,
        commissionPublicTypeA_Bps: updateData.commissionPublicTypeA_Bps ?? 750,
        commissionPublicTypeB_Bps: updateData.commissionPublicTypeB_Bps ?? 1000,
        commissionDigital_Bps: updateData.commissionDigital_Bps ?? 1000,
        commissionPro_Bps: updateData.commissionPro_Bps ?? null,
        stuckOrderDays: updateData.stuckOrderDays ?? 7,
        downloadLinkDays: updateData.downloadLinkDays ?? 30,
        photoDeletionDays: updateData.photoDeletionDays ?? 45,
        maintenanceMode: updateData.maintenanceMode ?? false,
        whatsappEnabled: updateData.whatsappEnabled ?? false,
        whatsappMaxPhotosToSend: updateData.whatsappMaxPhotosToSend ?? 10,
        whatsappSendInitialMessage: updateData.whatsappSendInitialMessage ?? true,
        whatsappSendFinalMessage: updateData.whatsappSendFinalMessage ?? true,
        whatsappSendDownloadLinkForLargeOrders: updateData.whatsappSendDownloadLinkForLargeOrders ?? true,
        whatsappDeliveryEnabledForPaidOrders: updateData.whatsappDeliveryEnabledForPaidOrders ?? true,
      },
    });

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "UPDATE_CONFIG",
      entityType: "Config",
      entityId: 1,
      description: `Configuración actualizada: ${Object.keys(updateData).join(", ")}`,
      beforeData: currentConfig,
      afterData: config,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(config);
  } catch (err: any) {
    console.error("PATCH /api/admin/config ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando configuración", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
