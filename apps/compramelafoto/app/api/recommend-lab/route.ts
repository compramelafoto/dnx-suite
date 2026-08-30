/**
 * POST /api/recommend-lab
 * Formulario público: un fotógrafo recomienda un laboratorio.
 * Guarda en LabRecommendation y envía email al laboratorio desde ComprameLaFoto.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { emailSignature } from "@/emails/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHATSAPP_LAB_INFO = "543413748324";
const WHATSAPP_LAB_URL = `https://wa.me/${WHATSAPP_LAB_INFO}?text=${encodeURIComponent("Hola, quiero más información sobre ComprameLaFoto para laboratorios.")}`;

function buildLabRecommendationEmail(params: {
  photographerName: string;
  labName: string;
}): { subject: string; bodyText: string; bodyHtml: string } {
  const { photographerName, labName } = params;
  const subject = "Un fotógrafo te recomendó ComprameLaFoto";
  const bodyText = [
    `Hola ${labName},`,
    "",
    `Desde ComprameLaFoto te saludamos. ${photographerName} te recomendó para usar nuestra plataforma.`,
    "",
    "ComprameLaFoto conecta fotógrafos con laboratorios y clientes: los fotógrafos suben álbumes, los clientes eligen fotos para imprimir o descargar, y los laboratorios reciben pedidos de impresión. Vas a tener disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.",
    "",
    "Para darte de alta como laboratorio:",
    "1. Entrá a https://www.compramelafoto.com",
    "2. Registrate y elegí la opción de Laboratorio.",
    "3. Completá el formulario con los datos de tu laboratorio.",
    "4. Una vez aprobada tu cuenta, tendrás disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.",
    "",
    `Si querés más información enviános un WhatsApp al ${WHATSAPP_LAB_INFO}: ${WHATSAPP_LAB_URL}`,
    "",
    "Saludos,",
    "Equipo de ComprameLaFoto",
    "www.compramelafoto.com",
  ].join("\n");

  const bodyHtml = `
    <p>Hola <strong>${escapeHtml(labName)}</strong>,</p>
    <p>Desde ComprameLaFoto te saludamos. <strong>${escapeHtml(photographerName)}</strong> te recomendó para usar nuestra plataforma.</p>
    <p>ComprameLaFoto conecta fotógrafos con laboratorios y clientes: los fotógrafos suben álbumes, los clientes eligen fotos para imprimir o descargar, y los laboratorios reciben pedidos de impresión. <strong>Vas a tener disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.</strong></p>
    <p><strong>Para darte de alta como laboratorio:</strong></p>
    <ol>
      <li>Entrá a <a href="https://www.compramelafoto.com">www.compramelafoto.com</a></li>
      <li>Registrate y elegí la opción de Laboratorio.</li>
      <li>Completá el formulario con los datos de tu laboratorio.</li>
      <li>Una vez aprobada tu cuenta, tendrás disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.</li>
    </ol>
    <p>Si querés más información enviános un WhatsApp al <a href="${WHATSAPP_LAB_URL}">3413748324</a>.</p>
    <p>Saludos,<br/>Equipo de ComprameLaFoto</p>
    ${emailSignature()}
  `.trim();

  return { subject, bodyText, bodyHtml };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const photographerName = typeof body.photographerName === "string" ? body.photographerName.trim() : "";
    const labName = typeof body.labName === "string" ? body.labName.trim() : "";
    const labEmail = typeof body.labEmail === "string" ? body.labEmail.trim().toLowerCase() : "";
    const labWhatsapp = typeof body.labWhatsapp === "string" ? body.labWhatsapp.trim() || null : null;

    if (!photographerName) {
      return NextResponse.json({ error: "El nombre del fotógrafo es obligatorio" }, { status: 400 });
    }
    if (!labName) {
      return NextResponse.json({ error: "El nombre del laboratorio es obligatorio" }, { status: 400 });
    }
    if (!labEmail) {
      return NextResponse.json({ error: "El email del laboratorio es obligatorio" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(labEmail)) {
      return NextResponse.json({ error: "El email del laboratorio no es válido" }, { status: 400 });
    }

    const rec = await prisma.labRecommendation.create({
      data: {
        photographerName,
        labName,
        labEmail,
        labWhatsapp,
      },
    });

    const { subject, bodyText, bodyHtml } = buildLabRecommendationEmail({
      photographerName,
      labName,
    });

    await queueEmail({
      to: labEmail,
      subject,
      body: bodyText,
      htmlBody: bodyHtml,
      idempotencyKey: `lab_recommend_${rec.id}`,
    });

    await prisma.labRecommendation.update({
      where: { id: rec.id },
      data: { emailSentAt: new Date() },
    });

    return NextResponse.json({ success: true, id: rec.id });
  } catch (err: any) {
    console.error("POST /api/recommend-lab ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al enviar la recomendación", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
