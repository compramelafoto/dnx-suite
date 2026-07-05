import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isLikelyValidEmail, normalizeEmail } from "@/lib/email-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  email: z.string().min(1, "El email es obligatorio").max(200),
  name: z.string().max(120).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    if (!isLikelyValidEmail(email)) {
      return NextResponse.json({ error: "Ingresá un email válido." }, { status: 400 });
    }

    const name = parsed.data.name?.trim() || null;
    const source = parsed.data.source?.trim() || "blog";

    await prisma.blogSubscriber.upsert({
      where: { email },
      create: {
        email,
        name,
        source,
        confirmed: false,
      },
      update: {
        ...(name ? { name } : {}),
        source,
        unsubscribedAt: null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "¡Gracias! Te suscribiste al newsletter del blog. Pronto vas a recibir novedades.",
    });
  } catch (err) {
    console.error("POST /api/public/blog/subscribe", err);
    return NextResponse.json(
      { error: "No pudimos registrar tu suscripción. Intentá de nuevo en unos minutos." },
      { status: 500 }
    );
  }
}
