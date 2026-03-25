import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Obtener laboratorios públicos con información de precios
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const whereClause: any = { isActive: true };

    // Si hay búsqueda general, buscar en todos los campos
    if (search && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
        { city: { contains: searchTerm, mode: "insensitive" } },
        { province: { contains: searchTerm, mode: "insensitive" } },
        { address: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const labs = await prisma.lab.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        country: true,
      },
      orderBy: { name: "asc" },
    });

    // Para cada laboratorio, verificar si tiene precios mayoristas (LabProduct)
    const labsWithPricingInfo = await Promise.all(
      labs.map(async (lab) => {
        // Verificar si tiene productos con precios mayoristas
        const hasWholesalePricing = await prisma.labProduct.count({
          where: {
            labId: lab.id,
            isActive: true,
            size: { not: null }, // Solo productos con tamaño (fotos)
          },
        });

        return {
          ...lab,
          hasWholesalePricing: hasWholesalePricing > 0,
        };
      })
    );

    return NextResponse.json(labsWithPricingInfo, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/public/labs ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo laboratorios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
