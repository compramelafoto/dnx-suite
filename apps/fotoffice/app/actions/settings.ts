"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { z } from "zod";
import { requireCoursesSalesContext } from "@/lib/workspace";

const brandingSchema = z.object({
  publicSlug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug público inválido"),
  commercialName: z.string().min(1).max(200),
  logoUrl: z.string().max(2000).optional().nullable().or(z.literal("")),
  coverImageUrl: z.string().max(2000).optional().nullable().or(z.literal("")),
  contactEmail: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(80).optional().nullable(),
  whatsapp: z.string().max(500).optional().nullable(),
  instagram: z.string().max(500).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  defaultCurrency: z.string().min(1).max(8),
  enrollmentCtaLabel: z.string().max(120).optional().nullable(),
  coursesFeePercent: z.coerce.number().min(0).max(100),
});

function emptyToNull(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export type SettingsFormState = { error: string | null; ok?: boolean };

export async function updateCoursesSalesSettingsAction(
  _prev: SettingsFormState | undefined,
  formData: FormData,
): Promise<SettingsFormState> {
  const { workspace, user } = await requireCoursesSalesContext();
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  const legacyMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  const canManageFee =
    membership?.role === "WORKSPACE_OWNER" ||
    membership?.role === "WORKSPACE_ADMIN" ||
    legacyMembership?.role === "ADMIN";
  if (!canManageFee) {
    return { error: "Solo owner/admin del workspace puede editar el fee de cursos." };
  }

  const raw = {
    publicSlug: formData.get("publicSlug")?.toString()?.trim() ?? "",
    commercialName: formData.get("commercialName")?.toString()?.trim() ?? "",
    logoUrl: emptyToNull(formData.get("logoUrl")?.toString()),
    coverImageUrl: emptyToNull(formData.get("coverImageUrl")?.toString()),
    contactEmail: emptyToNull(formData.get("contactEmail")?.toString()),
    phone: emptyToNull(formData.get("phone")?.toString()),
    whatsapp: emptyToNull(formData.get("whatsapp")?.toString()),
    instagram: emptyToNull(formData.get("instagram")?.toString()),
    website: emptyToNull(formData.get("website")?.toString()),
    defaultCurrency: formData.get("defaultCurrency")?.toString()?.trim() || "ARS",
    enrollmentCtaLabel: emptyToNull(formData.get("enrollmentCtaLabel")?.toString()),
    coursesFeePercent: formData.get("coursesFeePercent")?.toString() ?? "10",
  };

  const parsed = brandingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  const slugOwner = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: d.publicSlug },
    select: { workspaceId: true },
  });
  if (slugOwner && slugOwner.workspaceId !== workspace.id) {
    return { error: "Ese slug público ya está en uso por otro workspace." };
  }

  await prisma.fotofficeWorkspaceBranding.upsert({
    where: { workspaceId: workspace.id },
    update: {
      publicSlug: d.publicSlug,
      commercialName: d.commercialName,
      logoUrl: d.logoUrl,
      coverImageUrl: d.coverImageUrl,
      contactEmail: d.contactEmail,
      phone: d.phone,
      whatsapp: d.whatsapp,
      instagram: d.instagram,
      website: d.website,
    },
    create: {
      workspaceId: workspace.id,
      publicSlug: d.publicSlug,
      commercialName: d.commercialName,
      logoUrl: d.logoUrl,
      coverImageUrl: d.coverImageUrl,
      contactEmail: d.contactEmail,
      phone: d.phone,
      whatsapp: d.whatsapp,
      instagram: d.instagram,
      website: d.website,
    },
  });

  await prisma.courseSalesWorkspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      defaultCurrency: d.defaultCurrency,
      enrollmentCtaLabel: d.enrollmentCtaLabel ?? "Quiero inscribirme",
      coursesFeePercent: d.coursesFeePercent,
    },
    create: {
      workspaceId: workspace.id,
      defaultCurrency: d.defaultCurrency,
      enrollmentCtaLabel: d.enrollmentCtaLabel ?? "Quiero inscribirme",
      coursesFeePercent: d.coursesFeePercent,
    },
  });

  revalidatePath("/courses/settings");
  revalidatePath("/courses");
  revalidatePath("/w"); // rutas públicas
  return { error: null, ok: true };
}
