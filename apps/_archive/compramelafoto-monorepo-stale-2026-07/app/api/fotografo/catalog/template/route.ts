import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const headers = [
      "product_variant_id",
      "product_name",
      "category",
      "size",
      "finish",
      "material",
      "sla_days",
      "price_retail_ars",
      "active",
    ];

    const exampleRow = [
      "",
      "Fotos impresas",
      "IMPRESION",
      "10x15",
      "BRILLO",
      "",
      5,
      500,
      "SI",
    ];

    const rows = [headers, exampleRow];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws["!cols"] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 18 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-catalogo.xlsx"',
      },
    });
  } catch (err: any) {
    console.error("Error generando plantilla:", err);
    return NextResponse.json(
      { error: "Error al generar plantilla", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
