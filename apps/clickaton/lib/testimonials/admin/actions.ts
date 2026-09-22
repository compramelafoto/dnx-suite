"use server";

import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { EXCERPT_MAX_LENGTH } from "../domain/survey-definition";
import { canPublish } from "../ui/testimonial-status-presentation";

export type ModerationState = { ok: boolean; message?: string };

function refresh(responseId?: string) {
  revalidatePath(adminRoutes.testimonials);
  revalidatePath(`${adminRoutes.testimonials}/respuestas`);
  if (responseId) {
    revalidatePath(`${adminRoutes.testimonials}/respuestas/${responseId}`);
  }
  // Las secciones públicas cambian en el mismo acto.
  revalidatePath("/");
}

function readId(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function publishTestimonialAction(
  _prev: ModerationState | undefined,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await requireClickatonAdmin();
  const testimonialId = readId(formData, "testimonialId");
  if (!testimonialId) return { ok: false, message: "Falta el testimonio." };

  const testimonial = await prisma.clickatonTestimonial.findUnique({
    where: { id: testimonialId },
    select: {
      status: true,
      publicationConsent: true,
      surveyResponseId: true,
      quote: true,
    },
  });
  if (!testimonial) return { ok: false, message: "No encontramos el testimonio." };

  const gate = canPublish(testimonial);
  if (!gate.allowed) return { ok: false, message: gate.reason };

  const excerptRaw = formData.get("highlightedExcerpt");
  const excerpt =
    typeof excerptRaw === "string" && excerptRaw.trim()
      ? excerptRaw.trim().slice(0, EXCERPT_MAX_LENGTH)
      : null;

  await prisma.clickatonTestimonial.update({
    where: { id: testimonialId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      moderatedByUserId: admin.id,
      ...(excerpt ? { highlightedExcerpt: excerpt } : {}),
    },
  });

  refresh(testimonial.surveyResponseId);
  return { ok: true, message: "Publicado." };
}

export async function unpublishTestimonialAction(
  _prev: ModerationState | undefined,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await requireClickatonAdmin();
  const testimonialId = readId(formData, "testimonialId");
  if (!testimonialId) return { ok: false, message: "Falta el testimonio." };

  const testimonial = await prisma.clickatonTestimonial.update({
    where: { id: testimonialId },
    data: {
      status: "PENDING",
      publishedAt: null,
      moderatedByUserId: admin.id,
    },
    select: { surveyResponseId: true },
  });

  refresh(testimonial.surveyResponseId);
  return { ok: true, message: "Despublicado. Vuelve a quedar pendiente." };
}

export async function rejectTestimonialAction(
  _prev: ModerationState | undefined,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await requireClickatonAdmin();
  const testimonialId = readId(formData, "testimonialId");
  if (!testimonialId) return { ok: false, message: "Falta el testimonio." };

  const notesRaw = formData.get("moderationNotes");
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : null;

  const testimonial = await prisma.clickatonTestimonial.update({
    where: { id: testimonialId },
    data: {
      status: "REJECTED",
      publishedAt: null,
      moderatedByUserId: admin.id,
      moderationNotes: notes,
    },
    select: { surveyResponseId: true },
  });

  refresh(testimonial.surveyResponseId);
  return { ok: true, message: "Rechazado. No se publica." };
}

export async function saveExcerptAction(
  _prev: ModerationState | undefined,
  formData: FormData,
): Promise<ModerationState> {
  await requireClickatonAdmin();
  const testimonialId = readId(formData, "testimonialId");
  if (!testimonialId) return { ok: false, message: "Falta el testimonio." };

  const raw = formData.get("highlightedExcerpt");
  const excerpt =
    typeof raw === "string" && raw.trim()
      ? raw.trim().slice(0, EXCERPT_MAX_LENGTH)
      : null;

  const testimonial = await prisma.clickatonTestimonial.update({
    where: { id: testimonialId },
    data: { highlightedExcerpt: excerpt },
    select: { surveyResponseId: true },
  });

  refresh(testimonial.surveyResponseId);
  return { ok: true, message: "Guardamos el fragmento." };
}
