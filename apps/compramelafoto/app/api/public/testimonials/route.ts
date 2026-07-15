import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  listApprovedTestimonials,
  sanitizeTestimonialInput,
} from "@/lib/public/public-testimonials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: testimonios aprobados (land y /testimonios). */
export async function GET() {
  try {
    const testimonials = await listApprovedTestimonials(prisma);
    return NextResponse.json(testimonials);
  } catch (err: unknown) {
    console.error("GET /api/public/testimonials ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo testimonios" },
      { status: 500 }
    );
  }
}

/** POST: crear testimonio (público, queda pendiente de aprobación). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = sanitizeTestimonialInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const testimonial = await prisma.testimonial.create({
      data: {
        name: parsed.name,
        message: parsed.message,
        instagram: parsed.instagram,
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
