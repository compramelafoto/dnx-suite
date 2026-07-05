import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeWhatsApp(value: string): string {
  return value.trim();
}

function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const whatsapp = normalizeWhatsApp(String(body?.whatsapp ?? ""));
    const email = normalizeEmail(String(body?.email ?? ""));
    const slug = String(body?.slug ?? "charlafotoescolar").trim() || "charlafotoescolar";
    const source = String(body?.source ?? slug).trim() || slug;

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
      return NextResponse.json({ error: "Inscripciones cerradas." }, { status: 403 });
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

    const lead = await prisma.talkLead.create({
      data: {
        talkId: talk.id,
        name,
        whatsapp,
        email,
        source: talk.sourceTag || source,
      },
    });

    return NextResponse.json({ id: lead.id }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/charlafotoescolar ERROR >>>", err);
    return NextResponse.json(
      { error: "No pudimos guardar tus datos. Probá de nuevo." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const leadId = Number(body?.leadId);
    const action = String(body?.action ?? "").trim();

    if (!Number.isFinite(leadId)) {
      return NextResponse.json({ error: "Lead inválido." }, { status: 400 });
    }

    const now = new Date();
    const data =
      action === "calendar"
        ? { calendarClickedAt: now }
        : action === "whatsapp"
        ? { whatsappClickedAt: now }
        : null;

    if (!data) {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    await prisma.talkLead.update({
      where: { id: leadId },
      data,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/charlafotoescolar ERROR >>>", err);
    return NextResponse.json(
      { error: "No pudimos registrar el evento." },
      { status: 500 }
    );
  }
}
