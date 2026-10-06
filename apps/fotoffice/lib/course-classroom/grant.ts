// lib/course-classroom/grant.ts
import "server-only";
import { Prisma, prisma } from "@repo/db";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { appUrl } from "@/lib/app-url";
import { calcularVencimiento } from "./access-rules";
import { invitacionASociarse } from "./asociarse";
import { asegurarCuentaDelAlumno, crearEnlaceParaContrasena } from "./account";
import { sendBienvenidaAlumnoEmail, sendCursoEnTuPortalEmail, type InvitacionASociarse } from "./email";

export type OtorgarResultado =
  | { ok: true; accessId: string; expiresAt: Date | null; nuevo: boolean }
  | { ok: false; reason: "inscripcion_no_encontrada" | "inscripcion_no_aprobada" | "no_es_grabado" };

/**
 * Da a una persona el acceso que pagó.
 *
 * Idempotente por inscripción: el mismo aviso de pago dos veces no duplica nada. Si la persona
 * ya tenía el curso —de beneficio de socio, o de una compra anterior— el acceso existente pasa
 * a esta compra (`@@unique([userId, courseId])`): no se parte el avance. Lo pagado no depende
 * de ser socio, y renovar extiende desde el vencimiento vigente.
 */
export async function otorgarAccesoPorCompra(
  input: { enrollmentId: string; userId: number },
  ahora: Date = new Date(),
): Promise<OtorgarResultado> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: input.enrollmentId },
    select: {
      id: true,
      workspaceId: true,
      courseId: true,
      createdAt: true,
      paymentStatus: true,
      course: { select: { deliveryMode: true, accessMonths: true } },
    },
  });
  if (!inscripcion) return { ok: false, reason: "inscripcion_no_encontrada" };
  if (inscripcion.paymentStatus !== "APPROVED") return { ok: false, reason: "inscripcion_no_aprobada" };
  if (inscripcion.course.deliveryMode !== "RECORDED") return { ok: false, reason: "no_es_grabado" };

  const clave = { userId_courseId: { userId: input.userId, courseId: inscripcion.courseId } };
  const vence = calcularVencimiento(ahora, inscripcion.course.accessMonths);
  const existente = await prisma.courseAccess.findUnique({
    where: clave,
    select: {
      id: true,
      enrollmentId: true,
      origin: true,
      expiresAt: true,
      enrollment: { select: { createdAt: true } },
    },
  });

  if (existente) {
    if (existente.enrollmentId === inscripcion.id) {
      return { ok: true, accessId: existente.id, expiresAt: existente.expiresAt, nuevo: false };
    }
    // Una compra más vieja que la que ya tiene el acceso no lo mueve ni lo renueva: si no, el
    // acceso rebotaría entre dos inscripciones y el vencimiento se renovaría solo.
    if (existente.origin === "PURCHASE" && inscripcion.createdAt <= existente.enrollment.createdAt) {
      return { ok: true, accessId: existente.id, expiresAt: existente.expiresAt, nuevo: false };
    }
    // Renovar una compra vigente extiende desde el vencimiento actual; si no, desde hoy.
    const desde =
      existente.origin === "PURCHASE" && existente.expiresAt && existente.expiresAt > ahora
        ? existente.expiresAt
        : ahora;
    const expiresAt = calcularVencimiento(desde, inscripcion.course.accessMonths);
    await prisma.courseAccess.update({
      where: { id: existente.id },
      data: { origin: "PURCHASE", enrollmentId: inscripcion.id, expiresAt, revokedAt: null },
    });
    return { ok: true, accessId: existente.id, expiresAt, nuevo: true };
  }

  try {
    const creado = await prisma.courseAccess.create({
      data: {
        workspaceId: inscripcion.workspaceId,
        courseId: inscripcion.courseId,
        enrollmentId: inscripcion.id,
        userId: input.userId,
        origin: "PURCHASE",
        grantedAt: ahora,
        expiresAt: vence,
      },
      select: { id: true },
    });
    return { ok: true, accessId: creado.id, expiresAt: vence, nuevo: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const ganador = await prisma.courseAccess.findUnique({
        where: clave,
        select: { id: true, expiresAt: true },
      });
      if (ganador) return { ok: true, accessId: ganador.id, expiresAt: ganador.expiresAt, nuevo: false };
    }
    throw error;
  }
}

export type AvisoDeps = {
  asegurarCuenta: typeof asegurarCuentaDelAlumno;
  otorgar: typeof otorgarAccesoPorCompra;
  invitacionASociarse: (workspaceId: string, userId: number) => Promise<InvitacionASociarse | null>;
  crearEnlaceContrasena: (userId: number, base: string) => Promise<string>;
  enviarCursoListo: typeof sendCursoEnTuPortalEmail;
  enviarBienvenida: typeof sendBienvenidaAlumnoEmail;
  cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>;
  base: string;
};

function depsPorDefecto(): AvisoDeps {
  return {
    asegurarCuenta: (email) => asegurarCuentaDelAlumno(email),
    otorgar: (input) => otorgarAccesoPorCompra(input),
    invitacionASociarse: (workspaceId, userId) => invitacionASociarse(workspaceId, userId),
    crearEnlaceContrasena: (userId, base) => crearEnlaceParaContrasena(userId, base),
    enviarCursoListo: sendCursoEnTuPortalEmail,
    enviarBienvenida: sendBienvenidaAlumnoEmail,
    cargarFirma: loadWorkspaceSignature,
    base: appUrl(),
  };
}

/**
 * Después de aprobarse el pago de un curso grabado: cuenta, acceso y un solo correo.
 *
 * **Nunca lanza**: se llama con el pago ya aprobado, y nada de esto puede deshacerlo. Si algo
 * falla, la persona igual puede entrar con "Olvidé mi contraseña", y Mis cursos le otorga el
 * acceso que falte (`otorgarAccesosPendientes`).
 */
export async function avisarAccesoAlAula(
  input: { enrollmentId: string; workspaceId: string; to: string; studentName: string; courseTitle: string },
  deps: AvisoDeps = depsPorDefecto(),
): Promise<{ avisado: boolean; motivo?: string }> {
  try {
    if (!deps.base) {
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo: "sin_app_url" });
      return { avisado: false, motivo: "sin_app_url" };
    }
    const cuenta = await deps.asegurarCuenta(input.to);
    if (!cuenta) {
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo: "sin_cuenta" });
      return { avisado: false, motivo: "sin_cuenta" };
    }
    const acceso = await deps.otorgar({ enrollmentId: input.enrollmentId, userId: cuenta.userId });
    if (!acceso.ok || !acceso.nuevo) {
      const motivo = acceso.ok ? "ya_existia" : acceso.reason;
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo });
      return { avisado: false, motivo };
    }

    const [invitacion, firma] = await Promise.all([
      // La invitación es opcional: si falla, el correo sale igual, sin ella.
      deps.invitacionASociarse(input.workspaceId, cuenta.userId).catch(() => null),
      deps.cargarFirma(input.workspaceId).catch(() => null),
    ]);
    const comun = {
      to: input.to,
      studentName: input.studentName,
      courseTitle: input.courseTitle,
      expiresAt: acceso.expiresAt,
      invitacion,
      signature: firma,
    };
    const envio = cuenta.puedeEntrar
      ? await deps.enviarCursoListo({ ...comun, portalUrl: `${deps.base}/portal/cursos` })
      : await deps.enviarBienvenida({
          ...comun,
          crearContrasenaUrl: await deps.crearEnlaceContrasena(cuenta.userId, deps.base),
          loginUrl: `${deps.base}/login?next=/portal/cursos`,
        });

    if (!envio.sent) {
      logCourseEvent("aula_correo_no_enviado", { enrollmentId: input.enrollmentId, motivo: envio.reason });
      return { avisado: false, motivo: envio.reason };
    }
    logCourseEvent("aula_acceso_avisado", {
      enrollmentId: input.enrollmentId,
      workspaceId: input.workspaceId,
      cuentaNueva: cuenta.creada,
    });
    return { avisado: true };
  } catch (error) {
    console.error("[fotoffice][cursos] no se pudo dar el acceso al curso", {
      enrollmentId: input.enrollmentId,
      motivo: error instanceof Error ? error.message : "desconocido",
    });
    return { avisado: false, motivo: "error" };
  }
}
