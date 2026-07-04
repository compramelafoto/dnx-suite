import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(_req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    const prismaAny = prisma as any;
    if (!prismaAny.photographerProduct?.findMany) {
      return NextResponse.json(
        { error: "No existe la tabla de productos de fotógrafo" },
        { status: 409 }
      );
    }

    const products = await prismaAny.photographerProduct.findMany({
      where: { userId: user.id },
      orderBy: [
        { name: "asc" },
        { size: "asc" },
      ],
    });

    const rows = products.map((p: any) => ({
      product_variant_id: p.id,
      product_name: p.name,
      category: "",
      size: p.size || "",
      finish: p.acabado || "",
      material: "",
      sla_days: 0,
      price_retail_ars: p.retailPrice ?? "",
      active: p.isActive ? "SI" : "NO",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
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

    XLSX.utils.book_append_sheet(wb, ws, "Catalogo");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

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
