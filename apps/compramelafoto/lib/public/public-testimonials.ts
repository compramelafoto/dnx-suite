/**
 * Testimonios públicos (land / /testimonios).
 */

import type { PrismaClient } from "@prisma/client";

export const TESTIMONIAL_PUBLIC_FIELDS = [
  "id",
  "name",
  "message",
  "instagram",
  "createdAt",
] as const;

export function buildApprovedTestimonialsWhere() {
  return { isApproved: true as const };
}

export async function listApprovedTestimonials(prisma: PrismaClient) {
  return prisma.testimonial.findMany({
    where: buildApprovedTestimonialsWhere(),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      message: true,
      instagram: true,
      createdAt: true,
    },
  });
}

export function sanitizeTestimonialInput(body: {
  name?: unknown;
  message?: unknown;
  instagram?: unknown;
}):
  | { ok: true; name: string; message: string; instagram: string | null }
  | { ok: false; error: string; status: number } {
  const name = (body.name ?? "").toString().trim();
  const message = (body.message ?? "").toString().trim();
  const instagram = (body.instagram ?? "").toString().trim() || null;

  if (!name || !message) {
    return { ok: false, error: "Nombre y mensaje son requeridos", status: 400 };
  }
  if (message.length > 2000) {
    return {
      ok: false,
      error: "El mensaje no puede superar 2000 caracteres",
      status: 400,
    };
  }

  return { ok: true, name, message, instagram };
}
