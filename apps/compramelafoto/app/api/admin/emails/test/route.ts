import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { queueEmail } from "@/lib/email-queue";
import { buildTemplateDataFromOrder } from "@/lib/email-test-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { templateKey, recipientEmail, orderId, orderType, templateData } = body;

  if (!templateKey || !recipientEmail) {
    return NextResponse.json(
      { error: "templateKey y recipientEmail son obligatorios" },
      { status: 400 }
    );
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { key: templateKey },
  });

  if (!template || !template.isActive) {
    return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
  }

  let data: Record<string, string | number | boolean | null> = {};
  if (templateData && typeof templateData === "object") {
    data = { ...templateData };
  }

  if (orderId && orderType) {
    const orderData = await buildTemplateDataFromOrder({
      orderId: Number(orderId),
      type: orderType === "PRINT" ? "PRINT" : "ALBUM",
    });
    if (orderData) {
      data = { ...orderData, ...data };
    }
  }

  const { id: queueId } = await queueEmail({
    to: String(recipientEmail),
    subject: template.subject,
    body: template.bodyText,
    htmlBody: template.bodyHtml ?? undefined,
    templateId: template.id,
    templateData: data,
    priority: 1,
    idempotencyKey: `test_${template.key}_${Date.now()}`,
  });

  return NextResponse.json({
    success: true,
    message: "Email encolado para pruebas",
    queueId,
  });
}
