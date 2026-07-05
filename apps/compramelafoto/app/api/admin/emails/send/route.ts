import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { sendEmail } from "@/emails/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wrapHtml(body: string) {
  const safeBody = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin: 0 0 12px;">${line}</p>`)
    .join("");
  return `<div style="font-family: Arial, sans-serif; font-size: 15px; color: #111827; line-height: 1.6;">${safeBody}</div>`;
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const to = (body.to ?? "").toString().trim().toLowerCase();
  const subject = (body.subject ?? "").toString().trim();
  const content = (body.body ?? "").toString().trim();

  if (!to || !subject || !content) {
    return NextResponse.json(
      { error: "to, subject y body son requeridos" },
      { status: 400 }
    );
  }

  const html = wrapHtml(content);
  const result = await sendEmail({
    to,
    subject,
    html,
    templateKey: "ADMIN_MANUAL",
  });

  if (!result.success) {
    return NextResponse.json(
      { error: "No se pudo enviar el email", detail: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
