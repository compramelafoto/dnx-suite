import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { safeFilename } from "@/lib/safe-filename";
import { buildSchoolOperationsPdfBytes } from "@/lib/dashboard/album-school-operations/build-school-operations-pdf";
import { describeExportFilters } from "@/lib/dashboard/album-school-operations/school-operations-export-format";
import {
  loadSchoolOperationsOrders,
  parseSchoolOperationsFilters,
} from "@/lib/dashboard/album-school-operations/school-operations-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/school-operations/export/pdf
 * PDF imprimible del operativo escolar; mismos filtros que el listado.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const albumId = parseInt(id, 10);
    if (!Number.isInteger(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const filters = parseSchoolOperationsFilters(new URL(req.url).searchParams);
    const result = await loadSchoolOperationsOrders(albumId, user.id, filters);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const generatedAt = new Date();
    const bytes = await buildSchoolOperationsPdfBytes({
      albumTitle: result.albumTitle,
      generatedAt,
      filterDescription: describeExportFilters(filters),
      orders: result.orders,
    });

    const slugPart = safeFilename(result.albumPublicSlug || "", "album");
    const filename = safeFilename(`operativo-escolar-album-${albumId}-${slugPart}`, `operativo-escolar-album-${albumId}`);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  } catch (e) {
    console.error("GET .../school-operations/export/pdf:", e);
    return NextResponse.json({ error: "Error al generar PDF" }, { status: 500 });
  }
}
