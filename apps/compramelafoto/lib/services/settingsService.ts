import { prisma } from "@/lib/prisma";

let configCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minuto

/**
 * Obtiene la configuración de la aplicación con cache
 */
export async function getAppConfig() {
  const now = Date.now();
  
  if (configCache && (now - cacheTimestamp) < CACHE_TTL) {
    return configCache;
  }

  let config: any = null;

  try {
    // Intentar obtener la configuración con todos los campos
    config = await prisma.appConfig.findUnique({
      where: { id: 1 },
    });
  } catch (err: any) {
    // Si falla porque faltan columnas, intentar obtener solo los campos básicos
    if (err?.code === "P2022" || err?.message?.includes("does not exist")) {
      console.warn("Algunas columnas no existen en AppConfig, usando valores por defecto");
      // Obtener solo los campos básicos que probablemente existen
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

  if (!config) {
    // Crear con valores por defecto (solo campos básicos que probablemente existen)
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
      // Si falla la creación, usar valores por defecto en memoria
      console.warn("No se pudo crear AppConfig, usando valores por defecto:", createErr);
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
      stuckOrderDays: config.stuckOrderDays ?? 7,
      downloadLinkDays: config.downloadLinkDays ?? 30,
      photoDeletionDays: config.photoDeletionDays ?? 45,
      maintenanceMode: config.maintenanceMode ?? false,
    };
  }

  configCache = config;
  cacheTimestamp = now;
  
  return config;
}

/**
 * Actualiza la configuración y limpia el cache
 */
export async function updateAppConfig(data: Partial<typeof configCache>) {
  const config = await prisma.appConfig.upsert({
    where: { id: 1 },
    update: data,
    create: {
      id: 1,
      ...data,
      minDigitalPhotoPrice: data.minDigitalPhotoPrice ?? 5000,
      platformCommissionPercent: data.platformCommissionPercent ?? 10,
      commissionPublicTypeA_Bps: data.commissionPublicTypeA_Bps ?? 750,
      commissionPublicTypeB_Bps: data.commissionPublicTypeB_Bps ?? 1000,
      commissionDigital_Bps: data.commissionDigital_Bps ?? 1000,
      stuckOrderDays: data.stuckOrderDays ?? 7,
      downloadLinkDays: data.downloadLinkDays ?? 30,
      photoDeletionDays: data.photoDeletionDays ?? 45,
      maintenanceMode: data.maintenanceMode ?? false,
    },
  });

  // Limpiar cache
  configCache = null;
  cacheTimestamp = 0;

  return config;
}

/**
 * Limpia el cache de configuración
 */
export function clearConfigCache() {
  configCache = null;
  cacheTimestamp = 0;
}
