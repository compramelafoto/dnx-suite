import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    // Obtener labId del usuario
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Obtener todas las variantes de productos
    const variants = await prisma.labProductVariant.findMany({
      where: { labId: lab.id },
      orderBy: [
        { productName: "asc" },
        { category: "asc" },
        { size: "asc" },
      ],
    });

    // Preparar datos para Excel
    const rows = variants.map((v) => ({
      product_variant_id: v.id,
      product_name: v.productName,
      category: v.category || "",
      description: v.description || "",
      size: v.size || "",
      finish: v.finish || "",
      material: v.material || "",
      sla_days: v.slaDays,
      price_retail_ars: v.priceRetailArs || "",
      price_wholesale_ars: v.priceWholesaleArs || "",
      active: v.isActive ? "SI" : "NO",
    }));

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

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

    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");

    // Generar buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Retornar archivo
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="catalogo-productos-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("Error exportando catálogo:", err);
    return NextResponse.json(
      { error: "Error al exportar catálogo", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
