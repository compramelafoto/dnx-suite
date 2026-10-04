// lib/course-classroom/grant.ts
import "server-only";
import { Prisma, prisma } from "@repo/db";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { generateInvitationToken, hashInvitationToken } from "@/lib/members/invitation-tokens";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { calcularVencimiento } from "./access-rules";
import { enlaceDelAula, sendClassroomAccessEmail } from "./email";

export type OtorgarResultado =
  | { ok: true; creado: true; token: string; expiresAt: Date }
  | { ok: true; creado: false }
  | { ok: false; reason: "inscripcion_no_encontrada" | "inscripcion_no_aprobada" | "no_es_grabado" };

/**
 * Crea el acceso al aula de una inscripción pagada a un curso grabado.
 *
 * Idempotente: si el acceso ya existe —o lo crea otro pedido al mismo tiempo, por el índice
 * único de `enrollmentId`— devuelve `creado: false` y **no** genera token nuevo. El token crudo
 * sólo sale de acá cuando se crea, para ir al correo.
 */
export async function otorgarAccesoAlAula(
  enrollmentId: string,
  ahora: Date = new Date(),
): Promise<OtorgarResultado> {
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      workspaceId: true,
      courseId: true,
      paymentStatus: true,
      course: { select: { deliveryMode: true, accessMonths: true } },
      access: { select: { id: true } },
    },
  });
  if (!inscripcion) return { ok: false, reason: "inscripcion_no_encontrada" };
  if (inscripcion.paymentStatus !== "APPROVED") return { ok: false, reason: "inscripcion_no_aprobada" };
  if (inscripcion.course.deliveryMode !== "RECORDED") return { ok: false, reason: "no_es_grabado" };
  if (inscripcion.access) return { ok: true, creado: false };

  const token = generateInvitationToken();
  const expiresAt = calcularVencimiento(ahora, inscripcion.course.accessMonths);
  try {
    await prisma.courseAccess.create({
      data: {
        workspaceId: inscripcion.workspaceId,
        courseId: inscripcion.courseId,
        enrollmentId: inscripcion.id,
        grantedAt: ahora,
        expiresAt,
        tokenHash: hashInvitationToken(token),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: true, creado: false };
    }
    throw error;
  }
  return { ok: true, creado: true, token, expiresAt };
}

export type AvisoDeps = {
  otorgar: (enrollmentId: string) => Promise<OtorgarResultado>;
  enviar: typeof sendClassroomAccessEmail;
  cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>;
  base: string;
};

function depsPorDefecto(): AvisoDeps {
  return {
    otorgar: (id) => otorgarAccesoAlAula(id),
    enviar: sendClassroomAccessEmail,
    cargarFirma: loadWorkspaceSignature,
    base: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim(),
  };
}

/**
 * Da el acceso y avisa por correo. **Nunca lanza**: se llama después de aprobar un pago, y un
 * correo que falla no puede deshacer ni trabar esa aprobación. El resultado queda en el log.
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
    const acceso = await deps.otorgar(input.enrollmentId);
    if (!acceso.ok || !acceso.creado) {
      const motivo = acceso.ok ? "ya_existia" : acceso.reason;
      logCourseEvent("aula_sin_aviso", { enrollmentId: input.enrollmentId, motivo });
      return { avisado: false, motivo };
    }
    const firma = await deps.cargarFirma(input.workspaceId);
    const envio = await deps.enviar({
      to: input.to,
      studentName: input.studentName,
      courseTitle: input.courseTitle,
      enlace: enlaceDelAula(deps.base, acceso.token),
      expiresAt: acceso.expiresAt,
      signature: firma,
    });
    if (!envio.sent) {
      logCourseEvent("aula_correo_no_enviado", { enrollmentId: input.enrollmentId, motivo: envio.reason });
      return { avisado: false, motivo: envio.reason };
    }
    logCourseEvent("aula_acceso_avisado", { enrollmentId: input.enrollmentId, workspaceId: input.workspaceId });
    return { avisado: true };
  } catch (error) {
    console.error("[fotoffice][cursos] no se pudo dar el acceso al aula", {
      enrollmentId: input.enrollmentId,
      error,
    });
    return { avisado: false, motivo: "error" };
  }
}
