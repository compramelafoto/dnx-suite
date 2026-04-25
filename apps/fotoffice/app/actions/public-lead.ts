"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { z } from "zod";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";

const leadSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(80).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
});

export type PublicLeadState = { error: string | null; ok?: boolean };

export async function submitPublicCourseLeadAction(
  workspaceSlug: string,
  courseSlug: string,
  _prev: PublicLeadState | undefined,
  formData: FormData,
): Promise<PublicLeadState> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) return { error: "Workspace no encontrado." };

  const mod = await prisma.workspaceFeatureModule.findUnique({
    where: {
      workspaceId_moduleKey: {
        workspaceId: branding.workspaceId,
        moduleKey: COURSES_SALES_MODULE_KEY,
      },
    },
  });
  if (!mod?.enabled) return { error: "Este curso no está disponible." };

  const course = await prisma.courseSalesCourse.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: courseSlug,
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  if (!course) return { error: "Curso no disponible." };

  const raw = {
    name: formData.get("name")?.toString()?.trim() ?? "",
    email: formData.get("email")?.toString()?.trim() ?? "",
    phone: formData.get("phone")?.toString()?.trim() || null,
    message: formData.get("message")?.toString()?.trim() || null,
  };
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisá el formulario." };
  }
  const d = parsed.data;

  await prisma.courseSalesLead.create({
    data: {
      workspaceId: branding.workspaceId,
      courseId: course.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      message: d.message,
      status: "NEW",
    },
  });

  revalidatePath(`/w/${workspaceSlug}/cursos/${courseSlug}`);
  return { error: null, ok: true };
}
