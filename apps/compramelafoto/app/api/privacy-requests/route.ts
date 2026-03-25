import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/emails/send";

export const dynamic = "force-dynamic";

const REQUEST_TYPES = [
  "ACCESO",
  "RECTIFICACION",
  "SUPRESION",
  "OCULTAR_FOTO",
  "BAJA_MARKETING",
  "DESACTIVAR_BIOMETRIA",
] as const;

const RELATIONSHIPS = ["TITULAR", "PADRE_MADRE_TUTOR"] as const;

const schema = z.object({
  type: z.enum(REQUEST_TYPES),
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  relationship: z.enum(RELATIONSHIPS).default("TITULAR"),
  description: z.string().max(2000).optional(),
  albumId: z.coerce.number().int().positive().optional(),
  photoId: z.coerce.number().int().positive().optional(),
  isRepresentative: z.boolean().refine((v) => v === true, {
    message: "Debés declarar ser titular o representante",
  }),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "";

  const rate = checkRateLimit({ key: `privacy-request:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat().join("; ") || "Datos inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const data = parsed.data;

  const request = await prisma.privacyRequest.create({
    data: {
      type: data.type,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone ?? undefined,
      relationship: data.relationship,
      description: data.description ?? undefined,
      albumId: data.albumId ?? undefined,
      photoId: data.photoId ?? undefined,
      status: "RECEIVED",
      metadata: {
        ip: ip.slice(0, 45),
        userAgent: userAgent.slice(0, 500),
        sourcePage: req.headers.get("referer") || "",
      },
    },
  });

  const contactEmail = process.env.PRIVACY_CONTACT_EMAIL || "privacidad@compramelafoto.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com";

  if (process.env.RESEND_API_KEY) {
    try {
      await sendEmail({
        to: data.email,
        subject: `ComprameLaFoto - Recibimos tu solicitud #${request.id}`,
        html: `
          <p>Hola ${data.fullName},</p>
          <p>Recibimos tu solicitud de ${data.type} (ticket #${request.id}).</p>
          <p>La vamos a revisar y te contestaremos a la brevedad al mismo correo.</p>
          <p>Para consultas: ${contactEmail}</p>
          <p><a href="${appUrl}/privacidad">Política de Privacidad</a></p>
        `,
        templateKey: "ADMIN_MANUAL",
        meta: {},
      });
    } catch (err) {
      console.error("Error enviando confirmación de solicitud:", err);
    }
  }

  return NextResponse.json({
    success: true,
    ticketId: request.id,
    message: `Solicitud recibida. Ticket #${request.id}. Revisá tu email para la confirmación.`,
  });
}
