import { Prisma, prisma } from "@repo/db";
import { loadPortalContext } from "@/lib/portal/access";
import { logCourseEvent } from "@/lib/presential-courses/log";

/**
 * Cursos gratis para socios: el público los paga, el socio activo de esa institución los toma
 * sin pagar desde su portal. El acceso que se da es `MEMBER_BENEFIT`: deja de verse si deja de
 * ser socio activo (spec §8).
 */

export function puedeAnotarseGratis(input: {
  esSocioActivo: boolean;
  curso: { freeForMembers: boolean; status: string; deliveryMode: string; workspaceId: string } | null;
  workspaceDelSocio: string | null;
  yaTieneAcceso: boolean;
}): { ok: true } | { ok: false; motivo: string } {
  if (!input.esSocioActivo || !input.workspaceDelSocio) return { ok: false, motivo: "Sólo para socios activos." };
  if (!input.curso || input.curso.status !== "PUBLISHED" || input.curso.deliveryMode !== "RECORDED") {
    return { ok: false, motivo: "Este curso no está disponible." };
  }
  if (!input.curso.freeForMembers) return { ok: false, motivo: "Este curso no es gratis para socios." };
  if (input.curso.workspaceId !== input.workspaceDelSocio) return { ok: false, motivo: "Este curso es de otra institución." };
  if (input.yaTieneAcceso) return { ok: false, motivo: "Ya tenés este curso." };
  return { ok: true };
}

export async function cursosGratisParaSocio(workspaceId: string, userId: number) {
  return prisma.course.findMany({
    where: {
      workspaceId,
      freeForMembers: true,
      status: "PUBLISHED",
      deliveryMode: "RECORDED",
      accesses: { none: { userId } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, shortDescription: true },
  });
}

/**
 * Anota gratis a un socio. Todo se comprueba de nuevo acá, en el servidor: el botón del portal
 * no es una garantía. La inscripción queda en $0, aprobada y marcada como beneficio, para que
 * figure en los números y se sepa quién lo tomó.
 */
export async function anotarseGratis(input: {
  userId: number;
  courseId: string;
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const [socio, curso, user, existente] = await Promise.all([
    loadPortalContext(input.userId),
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, title: true, workspaceId: true, freeForMembers: true, status: true, deliveryMode: true },
    }),
    prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } }),
    prisma.courseAccess.findUnique({
      where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
      select: { id: true },
    }),
  ]);

  const regla = puedeAnotarseGratis({
    esSocioActivo: socio !== null,
    curso,
    workspaceDelSocio: socio?.workspace.id ?? null,
    yaTieneAcceso: existente !== null,
  });
  if (!regla.ok) return regla;

  const ficha = await prisma.member.findUnique({
    where: { id: socio!.member.id },
    select: { firstName: true, lastName: true, documentNumber: true, phone: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const inscripcion = await tx.courseEnrollment.create({
        data: {
          workspaceId: curso!.workspaceId,
          courseId: curso!.id,
          name: `${ficha?.firstName ?? ""} ${ficha?.lastName ?? ""}`.trim() || (user?.email ?? ""),
          email: user?.email ?? "",
          whatsapp: ficha?.phone ?? "",
          dni: ficha?.documentNumber ?? "",
          paymentStatus: "APPROVED",
          paymentMethod: "MEMBER_BENEFIT",
          paymentProvider: "MEMBER_BENEFIT",
          amountArs: new Prisma.Decimal(0),
          platformFeePercent: new Prisma.Decimal(0),
          platformFeeArs: new Prisma.Decimal(0),
          netAmountArs: new Prisma.Decimal(0),
        },
        select: { id: true },
      });
      await tx.courseAccess.create({
        data: {
          workspaceId: curso!.workspaceId,
          courseId: curso!.id,
          enrollmentId: inscripcion.id,
          userId: input.userId,
          origin: "MEMBER_BENEFIT",
          expiresAt: null,
        },
      });
    });
  } catch (error) {
    // Doble clic: el otro pedido ya lo anotó.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: true };
    throw error;
  }
  logCourseEvent("beneficio_socio_anotado", { courseId: curso!.id, memberId: socio!.member.id });
  return { ok: true };
}
