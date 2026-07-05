import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { renderTemplate } from "@/lib/email-marketing/render-template";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const emailsRaw = body.emails ?? body.email ?? "";
  const emails = (Array.isArray(emailsRaw) ? emailsRaw : String(emailsRaw).split(/[\n,;]/))
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e && e.includes("@"));

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "Debe indicar al menos un email para el test" },
      { status: 400 }
    );
  }

  if (emails.length > 10) {
    return NextResponse.json(
      { error: "Máximo 10 emails para envío de prueba" },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com";

  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const email of emails) {
    const context = {
      firstName: "Usuario",
      lastName: "Test",
      email,
      workspaceName: "ComprameLaFoto",
      role: "Test",
      referralCode: "",
      unsubscribeUrl: `${baseUrl}/unsubscribe?token=test`,
    };

    const html = renderTemplate(campaign.html, context);
    const from = `${campaign.fromName} <${campaign.fromEmail}>`;

    try {
      const resend = new Resend(apiKey);
      const res = await resend.emails.send({
        from,
        to: email,
        subject: `[TEST] ${campaign.subject}`,
        html,
      });

      if (res.error) {
        results.push({ email, ok: false, error: res.error.message });
      } else {
        results.push({ email, ok: true });
      }
    } catch (err: unknown) {
      results.push({
        email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
