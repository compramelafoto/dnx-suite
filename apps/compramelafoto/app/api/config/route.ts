import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAlbumDigitalClientFeePercent,
  getPrintAlbumPlatformFeePercent,
} from "@/lib/pricing/print-pricing";

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

    const [albumDigitalPct, printAlbumPct] = await Promise.all([
      getAlbumDigitalClientFeePercent(),
      getPrintAlbumPlatformFeePercent(),
    ]);

    // Si no existe fila DB, igual devolvemos mínimos y fees resueltos vía AppConfig merged.
    if (!config) {
      return NextResponse.json({
        minDigitalPhotoPrice: 5000,
        platformCommissionPercent: 10,
        albumDigitalMarketplacePercent: albumDigitalPct,
        printAlbumPlatformFeePercent: printAlbumPct,
      });
    }

    return NextResponse.json({
      minDigitalPhotoPrice: config.minDigitalPhotoPrice,
      /** Columna legacy; puede diferir del % efectivo de digital/impreso (ver campos siguiente). */
      platformCommissionPercent: config.platformCommissionPercent,
      albumDigitalMarketplacePercent: albumDigitalPct,
      /** Fee sobre obra impresa (cliente fotógrafo): pro bps → digital bps → columna legacy. */
      printAlbumPlatformFeePercent: printAlbumPct,
      maintenanceMode: config.maintenanceMode ?? false,
    });
  } catch (err: any) {
    if (err?.message !== "config timeout") {
      console.error("GET /api/config ERROR >>>", err);
    }
    try {
      const [albumDigitalPct, printAlbumPct] = await Promise.all([
        getAlbumDigitalClientFeePercent(),
        getPrintAlbumPlatformFeePercent(),
      ]);
      return NextResponse.json({
        minDigitalPhotoPrice: 5000,
        platformCommissionPercent: 10,
        albumDigitalMarketplacePercent: albumDigitalPct,
        printAlbumPlatformFeePercent: printAlbumPct,
        maintenanceMode: false,
      });
    } catch {
      return NextResponse.json({
        minDigitalPhotoPrice: 5000,
        platformCommissionPercent: 10,
        albumDigitalMarketplacePercent: 10,
        printAlbumPlatformFeePercent: 10,
        maintenanceMode: false,
      });
    }
  }
}
