import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/emails/send";

export const PRIVACY_REQUEST_TYPES = [
  "ACCESO",
  "RECTIFICACION",
  "SUPRESION",
  "OCULTAR_FOTO",
  "BAJA_MARKETING",
  "DESACTIVAR_BIOMETRIA",
] as const;

export const PRIVACY_RELATIONSHIPS = ["TITULAR", "PADRE_MADRE_TUTOR"] as const;

export const privacyRequestSchema = z.object({
  type: z.enum(PRIVACY_REQUEST_TYPES),
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  relationship: z.enum(PRIVACY_RELATIONSHIPS).default("TITULAR"),
  description: z.string().max(2000).optional(),
  albumId: z.coerce.number().int().positive().optional(),
  photoId: z.coerce.number().int().positive().optional(),
  isRepresentative: z.boolean().refine((v) => v === true, {
    message: "Debés declarar ser titular o representante",
  }),
});

export type PrivacyRequestData = z.infer<typeof privacyRequestSchema>;

/**
 * Guarda la solicitud de privacidad (RECEIVED) y manda la confirmación por mail si Resend está configurado.
 * La usan POST /api/privacy-requests y DNX Bot.
 */
export async function crearSolicitudDePrivacidad(
  data: PrivacyRequestData,
  meta: { ip: string; userAgent: string; sourcePage: string },
): Promise<{ id: number }> {
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
        ip: meta.ip.slice(0, 45),
        userAgent: meta.userAgent.slice(0, 500),
        sourcePage: meta.sourcePage,
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

  return { id: request.id };
}
