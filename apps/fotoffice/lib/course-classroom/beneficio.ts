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
  /** Espacios con un acuerdo ACTIVO y gratis para sus socios sobre este curso (cursos compartidos). */
  compartidoGratisCon?: ReadonlySet<string>;
}): ResultadoBeneficio {
  if (!input.esSocioActivo || !input.workspaceDelSocio) return { ok: false, codigo: "no-socio", motivo: MENSAJES_DE_BENEFICIO["no-socio"] };
  if (!input.curso || input.curso.status !== "PUBLISHED" || input.curso.deliveryMode !== "RECORDED") {
    return { ok: false, codigo: "no-disponible", motivo: MENSAJES_DE_BENEFICIO["no-disponible"] };
  }
  const propio = input.curso.workspaceId === input.workspaceDelSocio;
  if (!propio) {
    // Curso ajeno: vale sólo si el dueño se lo compartió gratis al espacio del socio.
    if (!input.compartidoGratisCon?.has(input.workspaceDelSocio)) {
      return { ok: false, codigo: "otra-institucion", motivo: MENSAJES_DE_BENEFICIO["otra-institucion"] };
    }
    // Si el dueño sumó beneficiarios después de compartirlo, regalarlo los dejaría sin cobrar.
    if (!input.curso.unicoBeneficiario) return { ok: false, codigo: "no-gratis", motivo: MENSAJES_DE_BENEFICIO["no-gratis"] };
  } else {
    if (!input.curso.freeForMembers) return { ok: false, codigo: "no-gratis", motivo: MENSAJES_DE_BENEFICIO["no-gratis"] };
    if (!input.curso.unicoBeneficiario) return { ok: false, codigo: "no-gratis", motivo: MENSAJES_DE_BENEFICIO["no-gratis"] };
  }
  if (input.yaTieneAcceso) return { ok: false, codigo: "ya-lo-tiene", motivo: MENSAJES_DE_BENEFICIO["ya-lo-tiene"] };
  return { ok: true };
}

/** Condición de "compartido gratis con este espacio": acuerdo activo con `membersFree`. */
function compartidoGratisCon(workspaceId: string) {
  return { resaleAgreements: { some: { resellerWorkspaceId: workspaceId, status: "ACTIVO" as const, membersFree: true } } };
}

export async function cursosGratisParaSocio(workspaceId: string, userId: number) {
  const filas = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
      deliveryMode: "RECORDED",
      accesses: { none: { userId } },
      OR: [
        {
          workspaceId,
          freeForMembers: true,
          // Sin beneficiarios ajenos: regalarlo dejaría sin cobrar a los demás.
          beneficiaries: { every: { workspaceId } },
        },
        // Cursos de otros espacios que se lo compartieron gratis para sus socios.
        compartidoGratisCon(workspaceId),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, shortDescription: true, workspaceId: true, beneficiaries: { select: { workspaceId: true, shareBps: true } } },
  });
  // Los compartidos sólo valen sin beneficiarios ajenos (los propios ya lo filtra la consulta).
  return filas
    .filter((c) => esSinReparto(c.workspaceId, c.beneficiaries))
    .map(({ id, title, shortDescription }) => ({ id, title, shortDescription }));
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
      select: {
        id: true,
        title: true,
        workspaceId: true,
        freeForMembers: true,
        status: true,
        deliveryMode: true,
        beneficiaries: { select: { workspaceId: true, shareBps: true } },
        resaleAgreements: { where: { status: "ACTIVO", membersFree: true }, select: { id: true, resellerWorkspaceId: true } },
      },
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
    compartidoGratisCon: new Set(curso?.resaleAgreements.map((a) => a.resellerWorkspaceId) ?? []),
  });
  if (!regla.ok) return regla;

  // Lo da el espacio del socio: el dueño (curso propio) o el espacio al que se lo compartieron.
  // Con ese espacio se mide después la vigencia: si deja de ser socio de él, deja de verlo.
  const otorgante = socio!.workspace.id;
  const acuerdo = curso!.workspaceId === otorgante ? null : (curso!.resaleAgreements.find((a) => a.resellerWorkspaceId === otorgante) ?? null);

  const ficha = await prisma.member.findUnique({
    where: { id: socio!.member.id },
    select: { firstName: true, lastName: true, documentNumber: true, phone: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const inscripcion = await tx.courseEnrollment.create({
        data: {
          workspaceId: otorgante,
          courseId: curso!.id,
          resaleAgreementId: acuerdo?.id ?? null,
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
          workspaceId: otorgante,
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
