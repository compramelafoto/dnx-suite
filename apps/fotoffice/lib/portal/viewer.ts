import "server-only";
import { prisma } from "@repo/db";
import { loadPortalContext, type PortalContext } from "./access";

/**
 * Quién está mirando el portal.
 *
 * Dos tipos de persona: el **socio** (ficha `ACTIVE` con su cuenta) ve el portal de siempre; el
 * **alumno** (tiene cursos y no es socio activo) ve Mis cursos y la invitación a asociarse.
 *
 * Ser socio gana siempre: un socio con cursos sigue siendo socio. `loadPortalContext` no
 * cambia y sigue siendo sólo de socios — cada pantalla de socios lo pide por su cuenta, así que
 * un alumno no puede llegar a ninguna de ellas.
 */

export type PortalViewer =
  | { kind: "MEMBER"; context: PortalContext }
  | { kind: "STUDENT"; userId: number; fullName: string; workspace: { id: string; name: string } };

export type ViewerDeps = {
  cargarSocio: (userId: number) => Promise<PortalContext | null>;
  cargarAlumno: (userId: number) => Promise<{ fullName: string; workspace: { id: string; name: string } } | null>;
};

/**
 * La institución del alumno es la de su curso más reciente; el nombre, el de esa inscripción.
 * Si sólo tiene una inscripción aprobada sin acceso todavía (algo falló después del pago), se
 * toma de ahí: Mis cursos le otorga el acceso al entrar.
 */
async function cargarAlumnoPorDefecto(userId: number) {
  const acceso = await prisma.courseAccess.findFirst({
    where: { userId },
    orderBy: { grantedAt: "desc" },
    select: {
      enrollment: { select: { name: true } },
      course: { select: { workspace: { select: { id: true, name: true } } } },
    },
  });
  if (acceso) return { fullName: acceso.enrollment.name, workspace: acceso.course.workspace };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return null;
  const inscripcion = await prisma.courseEnrollment.findFirst({
    where: {
      email: { equals: user.email, mode: "insensitive" },
      paymentStatus: "APPROVED",
      course: { deliveryMode: "RECORDED" },
    },
    orderBy: { createdAt: "desc" },
    select: { name: true, workspace: { select: { id: true, name: true } } },
  });
  return inscripcion ? { fullName: inscripcion.name, workspace: inscripcion.workspace } : null;
}

export async function resolvePortalViewer(
  userId: number,
  deps: ViewerDeps = { cargarSocio: loadPortalContext, cargarAlumno: cargarAlumnoPorDefecto },
): Promise<PortalViewer | null> {
  const context = await deps.cargarSocio(userId);
  if (context) return { kind: "MEMBER", context };
  const alumno = await deps.cargarAlumno(userId);
  return alumno ? { kind: "STUDENT", userId, ...alumno } : null;
}
