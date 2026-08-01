import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    // Crear plantilla vacía con headers
    const headers = [
      "product_variant_id",
      "product_name",
      "category",
      "description",
      "size",
      "finish",
      "material",
      "sla_days",
      "price_retail_ars",
      "price_wholesale_ars",
      "active",
    ];

    // Ejemplo de fila (como array para aoa_to_sheet)
    const exampleRow = [
      "", // product_variant_id - Dejar vacío para crear nuevo
      "Fotos impresas", // product_name
      "IMPRESION", // category
      "Fotos impresas en papel fotográfico", // description
      "10x15", // size
      "BRILLO", // finish
      "", // material
      5, // sla_days
      500, // price_retail_ars
      400, // price_wholesale_ars
      "SI", // active
    ];

    const rows = [headers, exampleRow];

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 15 }, // product_variant_id
      { wch: 25 }, // product_name
      { wch: 20 }, // category
      { wch: 30 }, // description
      { wch: 15 }, // size
      { wch: 15 }, // finish
      { wch: 15 }, // material
      { wch: 10 }, // sla_days
      { wch: 18 }, // price_retail_ars
      { wch: 20 }, // price_wholesale_ars
      { wch: 10 }, // active
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");

    // Generar buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Retornar archivo
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
