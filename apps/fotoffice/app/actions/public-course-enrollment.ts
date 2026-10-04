"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, prisma } from "@repo/db";
import { z } from "zod";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "@/lib/presential-courses/availability";
import { resolverObjetivoDeInscripcion } from "@/lib/presential-courses/enrollment-target";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { splitByPlatformFee } from "@/lib/platform-fee/fee";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";

const enrollmentSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  whatsapp: z.string().min(6).max(40),
  dni: z.string().min(5).max(24),
  city: z.string().max(120).optional().nullable(),
  instagram: z.string().max(120).optional().nullable(),
  courseInstanceId: z.string().min(1).optional(),
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
    courseInstanceId: emptyToNull(formData.get("courseInstanceId")?.toString()) ?? undefined,
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
      instances: parsed.data.courseInstanceId
        ? { where: { id: parsed.data.courseInstanceId } }
        : { where: { id: "" } }, // sin edición elegida: no trae ninguna
    },
  });
  if (!course) return { error: "Curso no disponible para inscripción." };
  const instance = course.instances[0] ?? null;
  if (parsed.data.courseInstanceId && !instance) {
    return { error: "La edición seleccionada no es válida." };
  }

  let cuposLibres: number | null = null;
  if (instance) {
    const counts = await getApprovedEnrollmentCountsByInstanceIds([instance.id]);
    cuposLibres = computeAvailableSpots(instance.capacity, counts.get(instance.id) ?? 0);
  }

  const objetivo = resolverObjetivoDeInscripcion({
    deliveryMode: course.deliveryMode,
    precioDelCurso: course.priceArs,
    instancia: instance,
    cuposLibres,
  });
  if (!objetivo.ok) return { error: objetivo.error };

  // La comisión sale de WorkspaceModuleFee (default 5%), no de coursesFeePercent, que el
  // dueño del workspace podía editar y quedó deprecado.
  const feeBps = await getPlatformFeeBps(branding.workspaceId, COURSES_SALES_MODULE_KEY);
  const amount = objetivo.monto;
  const { fee, net } = splitByPlatformFee(amount, feeBps);
  const feePercent = new Prisma.Decimal(feeBps).div(100);

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      workspaceId: branding.workspaceId,
      courseId: course.id,
      courseInstanceId: objetivo.courseInstanceId,
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
