import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { safeFilename } from "@/lib/safe-filename";
import { schoolOperationsToExportRows } from "@/lib/dashboard/album-school-operations/school-operations-export-format";
import {
  loadSchoolOperationsOrders,
  parseSchoolOperationsFilters,
} from "@/lib/dashboard/album-school-operations/school-operations-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/school-operations/export/xlsx
 * Exporta operativo escolar en Excel; respeta los mismos query params que el listado.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
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

    const sheetRows =
      result.orders.length === 0
        ? [
            {
              "Apellido alumno": "",
              "Nombre alumno": "",
              Nivel: "",
              Turno: "",
              Curso: "",
              División: "",
              "Nombre del comprador": "",
              "Email comprador": "",
              "Resumen de compra": "",
              "Total (ARS)": "",
              "Fotos tomadas": "",
              Observaciones: "Sin pedidos que coincidan con los filtros actuales.",
            },
          ]
        : schoolOperationsToExportRows(result.orders);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 10 },
      { wch: 22 },
      { wch: 28 },
      { wch: 36 },
      { wch: 14 },
      { wch: 12 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Operativo escolar");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const slugPart = safeFilename(result.albumPublicSlug || "", "album");
    const filename = safeFilename(`operativo-escolar-album-${albumId}-${slugPart}`, `operativo-escolar-album-${albumId}`);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (e) {
    console.error("GET .../school-operations/export/xlsx:", e);
    return NextResponse.json({ error: "Error al generar Excel" }, { status: 500 });
  }
}
