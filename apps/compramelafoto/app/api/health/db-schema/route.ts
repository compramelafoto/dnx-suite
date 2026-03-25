import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/db-schema
 * Comprueba si la tabla Album tiene las columnas hiddenPhotosEnabled y hiddenSelfieRetentionDays.
 * Útil para verificar si la migración se aplicó en producción.
 */
export async function GET() {
  try {
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>(
      Prisma.sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND LOWER(table_name) = 'album'
          AND (LOWER(column_name) = 'hiddenphotosenabled' OR LOWER(column_name) = 'hiddenselfieretentiondays')
      `
    );
    const columnsLower = result.map((r) => r.column_name.toLowerCase());
    const hiddenPhotosEnabledExists = columnsLower.includes("hiddenphotosenabled");
    const hiddenSelfieRetentionDaysExists = columnsLower.includes("hiddenselfieretentiondays");
    return NextResponse.json({
      ok: true,
      hiddenPhotosEnabled: hiddenPhotosEnabledExists,
      hiddenSelfieRetentionDays: hiddenSelfieRetentionDaysExists,
      message: hiddenPhotosEnabledExists
        ? "Las columnas de fotos ocultas existen. La opción debería guardarse correctamente."
        : "Faltan las columnas. Ejecutá en tu PC: DATABASE_URL=\"tu-url-de-produccion\" npx prisma migrate deploy",
    });
  } catch (err: any) {
    console.error("GET /api/health/db-schema ERROR:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err), hiddenPhotosEnabled: false, hiddenSelfieRetentionDays: false },
      { status: 500 }
    );
  }
}
