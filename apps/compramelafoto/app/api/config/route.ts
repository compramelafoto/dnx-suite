import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CONFIG_TIMEOUT_MS = 8000;

/**
 * GET /api/config
 * Devuelve la configuración pública de la aplicación (solo lectura, no requiere autenticación).
 * Timeout para no colgar en cold start o si la DB tarda.
 */
export async function GET() {
  try {
    const config = await Promise.race([
      prisma.appConfig.findUnique({ where: { id: 1 } }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("config timeout")), CONFIG_TIMEOUT_MS)
      ),
    ]);

    // Si no existe, devolver valores por defecto
    if (!config) {
      return NextResponse.json({
        minDigitalPhotoPrice: 5000, // $5000 ARS en pesos
        platformCommissionPercent: 10, // 10%
      });
    }

    return NextResponse.json({
      minDigitalPhotoPrice: config.minDigitalPhotoPrice,
      platformCommissionPercent: config.platformCommissionPercent,
      maintenanceMode: config.maintenanceMode ?? false,
    });
  } catch (err: any) {
    if (err?.message !== "config timeout") {
      console.error("GET /api/config ERROR >>>", err);
    }
    // En caso de error o timeout, devolver valores por defecto
    return NextResponse.json({
      minDigitalPhotoPrice: 5000,
      platformCommissionPercent: 10,
      maintenanceMode: false,
    });
  }
}
