import "server-only";
import { Prisma, prisma } from "@repo/db";
import { esSinReparto } from "@/lib/course-marketplace/beneficiarios";
import { loadPortalContext } from "@/lib/portal/access";
import { logCourseEvent } from "@/lib/presential-courses/log";

/**
 * Cursos gratis para socios: el público los paga, el socio activo de esa institución los toma
 * sin pagar desde su portal. El acceso que se da es `MEMBER_BENEFIT`: deja de verse si deja de
 * ser socio activo (spec §8).
 */

export type CodigoDeBeneficio = "no-socio" | "no-disponible" | "no-gratis" | "otra-institucion" | "ya-lo-tiene";

/**
 * Textos fijos que la página de Mis cursos muestra según el `?aviso=` de la URL. La URL nunca
 * aporta texto: sólo se muestra lo que está en este mapa.
 */
export const MENSAJES_DE_BENEFICIO: Record<CodigoDeBeneficio, string> = {
  "no-socio": "Sólo para socios activos.",
  "no-disponible": "Este curso no está disponible.",
  "no-gratis": "Este curso no es gratis para socios.",
  "otra-institucion": "Este curso es de otra institución.",
  "ya-lo-tiene": "Ya tenés este curso.",
};

export function mensajeDeBeneficio(codigo: string | undefined): string | null {
  if (!codigo || !Object.prototype.hasOwnProperty.call(MENSAJES_DE_BENEFICIO, codigo)) return null;
  return MENSAJES_DE_BENEFICIO[codigo as CodigoDeBeneficio];
}

type ResultadoBeneficio = { ok: true } | { ok: false; codigo: CodigoDeBeneficio; motivo: string };

export function puedeAnotarseGratis(input: {
  esSocioActivo: boolean;
  curso: { freeForMembers: boolean; status: string; deliveryMode: string; workspaceId: string; unicoBeneficiario: boolean } | null;
  workspaceDelSocio: string | null;
  yaTieneAcceso: boolean;
}): ResultadoBeneficio {
  if (!input.esSocioActivo || !input.workspaceDelSocio) return { ok: false, codigo: "no-socio", motivo: MENSAJES_DE_BENEFICIO["no-socio"] };
  if (!input.curso || input.curso.status !== "PUBLISHED" || input.curso.deliveryMode !== "RECORDED") {
    return { ok: false, codigo: "no-disponible", motivo: MENSAJES_DE_BENEFICIO["no-disponible"] };
  }
  if (!input.curso.freeForMembers) return { ok: false, codigo: "no-gratis", motivo: MENSAJES_DE_BENEFICIO["no-gratis"] };
  if (!input.curso.unicoBeneficiario) return { ok: false, codigo: "no-gratis", motivo: MENSAJES_DE_BENEFICIO["no-gratis"] };
  if (input.curso.workspaceId !== input.workspaceDelSocio) return { ok: false, codigo: "otra-institucion", motivo: MENSAJES_DE_BENEFICIO["otra-institucion"] };
  if (input.yaTieneAcceso) return { ok: false, codigo: "ya-lo-tiene", motivo: MENSAJES_DE_BENEFICIO["ya-lo-tiene"] };
  return { ok: true };
}

export async function cursosGratisParaSocio(workspaceId: string, userId: number) {
  return prisma.course.findMany({
    where: {
      workspaceId,
      freeForMembers: true,
      // Sin beneficiarios ajenos: regalarlo dejaría sin cobrar a los demás.
      beneficiaries: { every: { workspaceId } },
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
}): Promise<ResultadoBeneficio> {
  const [socio, curso, user, existente] = await Promise.all([
    loadPortalContext(input.userId),
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, title: true, workspaceId: true, freeForMembers: true, status: true, deliveryMode: true, beneficiaries: { select: { workspaceId: true, shareBps: true } } },
    }),
    prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } }),
    prisma.courseAccess.findUnique({
      where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
      select: { id: true },
    }),
  ]);

  const regla = puedeAnotarseGratis({
    esSocioActivo: socio !== null,
    curso: curso ? { ...curso, unicoBeneficiario: esSinReparto(curso.workspaceId, curso.beneficiaries) } : null,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const yaAnotado = await prisma.courseAccess.findUnique({
        where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
        select: { id: true },
      });
      if (yaAnotado) return { ok: true };
    }
    throw error;
  }
  logCourseEvent("beneficio_socio_anotado", { courseId: curso!.id, memberId: socio!.member.id });
  return { ok: true };
}
