"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, prisma } from "@repo/db";
import { z } from "zod";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "@/lib/presential-courses/availability";
import { logCourseEvent } from "@/lib/presential-courses/log";

const enrollmentSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  whatsapp: z.string().min(6).max(40),
  dni: z.string().min(5).max(24),
  city: z.string().max(120).optional().nullable(),
  instagram: z.string().max(120).optional().nullable(),
  courseInstanceId: z.string().min(1),
});

function emptyToNull(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type State = { error: string | null };

export async function createPublicCourseEnrollmentAction(
  workspaceSlug: string,
  courseSlug: string,
  _prev: State | undefined,
  formData: FormData,
): Promise<State> {
  const parsed = enrollmentSchema.safeParse({
    name: formData.get("name")?.toString()?.trim() ?? "",
    email: formData.get("email")?.toString()?.trim() ?? "",
    whatsapp: formData.get("whatsapp")?.toString()?.trim() ?? "",
    dni: formData.get("dni")?.toString()?.trim() ?? "",
    city: emptyToNull(formData.get("city")?.toString()),
    instagram: emptyToNull(formData.get("instagram")?.toString()),
    courseInstanceId: formData.get("courseInstanceId")?.toString()?.trim() ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) return { error: "Workspace no encontrado." };

  const mod = await prisma.workspaceFeatureModule.findUnique({
    where: {
      workspaceId_moduleKey: { workspaceId: branding.workspaceId, moduleKey: COURSES_SALES_MODULE_KEY },
    },
  });
  if (!mod?.enabled) return { error: "Este módulo no está habilitado para este workspace." };

  const course = await prisma.course.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: courseSlug,
      status: "PUBLISHED",
    },
    include: {
      instances: {
        where: { id: parsed.data.courseInstanceId },
      },
    },
  });
  if (!course) return { error: "Curso no disponible para inscripción." };
  const instance = course.instances[0];
  if (!instance) return { error: "La edición seleccionada no es válida." };
  if (instance.status !== "ACTIVE") return { error: "La edición no está disponible para inscripción." };

  const counts = await getApprovedEnrollmentCountsByInstanceIds([instance.id]);
  const approvedCount = counts.get(instance.id) ?? 0;
  const availableSpots = computeAvailableSpots(instance.capacity, approvedCount);
  if (availableSpots <= 0) {
    return { error: "No hay cupos disponibles para esta edición." };
  }

  const settings = await prisma.courseSalesWorkspaceSettings.findUnique({
    where: { workspaceId: branding.workspaceId },
    select: { coursesFeePercent: true },
  });
  const feePercent = settings?.coursesFeePercent ?? new Prisma.Decimal(10);
  const amount = instance.priceArs;
  const fee = amount.mul(feePercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const net = amount.minus(fee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      workspaceId: branding.workspaceId,
      courseId: course.id,
      courseInstanceId: instance.id,
      name: parsed.data.name,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp,
      dni: parsed.data.dni,
      city: parsed.data.city,
      instagram: parsed.data.instagram,
      paymentStatus: "PENDING",
      paymentMethod: "MERCADO_PAGO",
      paymentProvider: "MERCADO_PAGO",
      amountArs: amount,
      platformFeePercent: feePercent,
      platformFeeArs: fee,
      netAmountArs: net,
    },
    select: { id: true },
  });
  logCourseEvent("enrollment_created", {
    enrollmentId: enrollment.id,
    workspaceId: branding.workspaceId,
    courseId: course.id,
  });
  revalidatePath(`/w/${workspaceSlug}/cursos/${courseSlug}`);
  redirect(`/w/${workspaceSlug}/cursos/${courseSlug}/inscripcion/pending?enrollmentId=${enrollment.id}`);
}
