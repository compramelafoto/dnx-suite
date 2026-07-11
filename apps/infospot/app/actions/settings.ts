"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@repo/db";
import {
  canManageInfoSpotSettings,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => !v || /^https?:\/\//i.test(v), "URL inválida");

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => !v || z.string().email().safeParse(v).success, "Email inválido");

const settingsSchema = z.object({
  siteName: z.string().trim().min(2).max(120),
  slogan: z.string().trim().min(2).max(240),
  contactEmail: optionalEmail,
  pressEmail: optionalEmail,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  xUrl: optionalUrl,
  whatsappUrl: optionalUrl,
  publicUrl: optionalUrl,
  seoTitle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  seoDescription: z
    .string()
    .trim()
    .max(320)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  defaultShareImageUrl: z
    .string()
    .trim()
    .max(800)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  logoUrl: z
    .string()
    .trim()
    .max(800)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  baseCity: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  country: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : "Argentina")),
  institutionalText: z
    .string()
    .trim()
    .max(8000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  footerText: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateInfoSpotSettingsAction(formData: FormData) {
  const access = await requireInfoSpotAdminAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    redirect("/admin?error=" + encodeURIComponent("Sin permiso para configurar el medio."));
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(
      "/admin/configuracion?error=" +
        encodeURIComponent(parsed.error.issues[0]?.message || "Datos inválidos"),
    );
  }

  const data = parsed.data;
  const existing = await prisma.infoSpotSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existing) {
    await prisma.infoSpotSettings.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.infoSpotSettings.create({ data });
  }

  revalidatePath("/");
  revalidatePath("/quienes-somos");
  revalidatePath("/contacto");
  revalidatePath("/colaboradores");
  revalidatePath("/admin/configuracion");
  redirect("/admin/configuracion?ok=saved");
}

export async function updateContentTagAction(
  kind: "article" | "event",
  id: string,
  formData: FormData,
) {
  const access = await requireInfoSpotAdminAccess();
  if (!canManageInfoSpotSettings(access.subject)) {
    redirect("/admin?error=" + encodeURIComponent("Sin permiso."));
  }

  const tag = String(formData.get("contentTag") || "");
  if (!["DEMO", "REAL", "NEEDS_REVIEW"].includes(tag)) {
    redirect("/admin/lanzamiento?error=tag");
  }

  if (kind === "article") {
    await prisma.infoSpotArticle.update({
      where: { id },
      data: { contentTag: tag as "DEMO" | "REAL" | "NEEDS_REVIEW" },
    });
  } else {
    await prisma.infoSpotEvent.update({
      where: { id },
      data: { contentTag: tag as "DEMO" | "REAL" | "NEEDS_REVIEW" },
    });
  }

  revalidatePath("/admin/lanzamiento");
  revalidatePath("/redaccion");
  revalidatePath("/admin/eventos");
  redirect("/admin/lanzamiento?ok=tagged");
}
