import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: Listar todos los testimonios (admin) */
export async function GET() {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const testimonials = await prisma.testimonial.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        message: true,
        instagram: true,
        isApproved: true,
        createdAt: true,
      },
    });
    return NextResponse.json(testimonials);
  } catch (err: unknown) {
    console.error("GET /api/admin/testimonials ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo testimonios" },
      { status: 500 }
    );
  }
}
