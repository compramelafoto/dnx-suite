import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CHARLAS_FPR_TALK_SLUG } from "@/lib/charlasfpr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const whatsapp = String(body?.whatsapp ?? "").trim();
    const email = normalizeEmail(String(body?.email ?? ""));
    const photographyType = String(body?.photographyType ?? "").trim();
    const slug = String(body?.slug ?? CHARLAS_FPR_TALK_SLUG).trim() || CHARLAS_FPR_TALK_SLUG;

    const talk = await prisma.talk.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        enableLeadCapture: true,
        requireName: true,
        requireWhatsapp: true,
        requireEmail: true,
        sourceTag: true,
      },
    });

    if (!talk || talk.status !== "PUBLISHED" || !talk.enableLeadCapture) {
      return NextResponse.json(
        { error: "Inscripciones cerradas. Contactá soporte si necesitás ayuda." },
        { status: 403 }
      );
    }

    if (talk.requireName && (!name || name.length < 2)) {
      return NextResponse.json({ error: "Ingresá tu nombre completo." }, { status: 400 });
    }
    if (talk.requireWhatsapp && (!whatsapp || whatsapp.length < 6)) {
      return NextResponse.json({ error: "Ingresá un WhatsApp válido." }, { status: 400 });
    }
    if (talk.requireEmail && (!email || !isValidEmail(email))) {
      return NextResponse.json({ error: "Ingresá un email válido." }, { status: 400 });
    }
    if (!photographyType || photographyType.length < 2) {
      return NextResponse.json({ error: "Indicá qué tipo de fotografía realizás." }, { status: 400 });
    }

    const lead = await prisma.talkLead.create({
      data: {
        talkId: talk.id,
        name,
        whatsapp,
        email,
        source: talk.sourceTag || "charlasfpr",
        photographyType,
      },
    });

    return NextResponse.json({ id: lead.id }, { status: 200 });
  } catch (err: unknown) {
    console.error("POST /api/charlasfpr ERROR >>>", err);
    return NextResponse.json(
      { error: "No pudimos guardar tus datos. Probá de nuevo." },
      { status: 500 }
    );
  }
}
