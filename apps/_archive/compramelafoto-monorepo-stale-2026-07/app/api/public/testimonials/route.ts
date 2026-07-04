import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: Listar testimonios aprobados (visibles en land y /testimonios) */
export async function GET() {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isApproved: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        message: true,
        instagram: true,
        createdAt: true,
      },
    });
    return NextResponse.json(testimonials);
  } catch (err: unknown) {
    console.error("GET /api/public/testimonials ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo testimonios" },
      { status: 500 }
    );
  }
}

/** POST: Crear testimonio (público, sin auth) */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body.name ?? "").toString().trim();
    const message = (body.message ?? "").toString().trim();
    const instagram = (body.instagram ?? "").toString().trim() || null;

    if (!name || !message) {
      return NextResponse.json(
        { error: "Nombre y mensaje son requeridos" },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "El mensaje no puede superar 2000 caracteres" },
        { status: 400 }
      );
    }

    const testimonial = await prisma.testimonial.create({
      data: {
        name,
        message,
        instagram: instagram || null,
      },
    });

    return NextResponse.json({
      id: testimonial.id,
      message: "Gracias por tu testimonio. Aparecerá pronto en la página.",
    });
  } catch (err: unknown) {
    console.error("POST /api/public/testimonials ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando el testimonio" },
      { status: 500 }
    );
  }
}
