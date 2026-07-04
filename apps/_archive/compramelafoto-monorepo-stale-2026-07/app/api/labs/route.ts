import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const whereClause: any = { 
      isActive: true,
      // Nota: Se removió el requisito de Mercado Pago para que aparezcan en la lista de selección
      // Los pedidos solo se pueden crear si el laboratorio tiene MP configurado (validado en otros endpoints)
    };

    // Si hay búsqueda, buscar en nombre, email, phone, city, province, address
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
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
        shippingEnabled: true,
        fulfillmentMode: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(labs, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/labs ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo laboratorios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
