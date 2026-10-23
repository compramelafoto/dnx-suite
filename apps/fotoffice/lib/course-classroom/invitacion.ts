// lib/course-classroom/invitacion.ts
import "server-only";
import { Prisma, prisma } from "@repo/db";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import type { WorkspaceSender } from "@/lib/communications/sender-name";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { appUrl } from "@/lib/app-url";
import { calcularVencimiento } from "./access-rules";
import { asegurarCuentaDelAlumno, crearEnlaceParaContrasena } from "./account";
import { buildInvitacionSinCargoEmailBody } from "./email";
import type { Invitado } from "./invitados";

/**
 * Invitar personas sin cargo a un curso grabado.
 *
 * Para cada una: la cuenta (se crea sin contraseña si no existe), una inscripción aprobada de
 * cero pesos con su acceso `INVITATION` por los meses del curso, y un correo para entrar. Quien
 * ya tiene el curso —comprado, de socio o de otra invitación— no se toca ni recibe otro correo:
 * reenviar la lista no duplica nada.
 *
 * Los correos salen de a uno y espaciados: Resend acepta pocos pedidos por segundo.
 */

export type ResultadoInvitado = {
  email: string;
  estado: "INVITADO" | "YA_TENIA" | "CORREO_INVALIDO" | "CORREO_NO_ENVIADO" | "ERROR";
  detalle?: string;
};

export type InvitacionInput = {
  workspaceId: string;
  courseId: string;
  invitados: Invitado[];
  asunto: string;
  mensaje: string;
};

type Curso = { id: string; title: string; accessMonths: number; workspaceId: string };

export type InvitacionDeps = {
  cargarCurso: (workspaceId: string, courseId: string) => Promise<Curso | null>;
  asegurarCuenta: typeof asegurarCuentaDelAlumno;
  yaTieneAcceso: (userId: number, courseId: string) => Promise<boolean>;
  darAcceso: (input: { curso: Curso; invitado: Invitado; userId: number; expiresAt: Date }) => Promise<"CREADO" | "YA_TENIA">;
  crearEnlaceContrasena: (userId: number, base: string) => Promise<string>;
  enviar: (mensaje: OutboundEmail) => Promise<SendOutcome>;
  cargarFirma: (workspaceId: string) => Promise<RenderedEmailSignature | null>;
  cargarRemitente: (workspaceId: string) => Promise<WorkspaceSender | null>;
  esperar: (ms: number) => Promise<void>;
  base: string;
  ahora: () => Date;
};

export const ESPERA_ENTRE_CORREOS_MS = 600;

async function darAccesoEnBase(input: {
  curso: Curso;
  invitado: Invitado;
  userId: number;
  expiresAt: Date;
}): Promise<"CREADO" | "YA_TENIA"> {
  try {
    await prisma.$transaction(async (tx) => {
      const inscripcion = await tx.courseEnrollment.create({
        data: {
          workspaceId: input.curso.workspaceId,
          courseId: input.curso.id,
          name: input.invitado.nombre || input.invitado.email,
          email: input.invitado.email,
          whatsapp: "",
          dni: "",
          paymentStatus: "APPROVED",
          paymentMethod: "INVITATION",
          paymentProvider: "INVITATION",
          amountArs: new Prisma.Decimal(0),
          platformFeePercent: new Prisma.Decimal(0),
          platformFeeArs: new Prisma.Decimal(0),
          netAmountArs: new Prisma.Decimal(0),
        },
        select: { id: true },
      });
      await tx.courseAccess.create({
        data: {
          workspaceId: input.curso.workspaceId,
          courseId: input.curso.id,
          enrollmentId: inscripcion.id,
          userId: input.userId,
          origin: "INVITATION",
          expiresAt: input.expiresAt,
        },
      });
    });
    return "CREADO";
  } catch (error) {
    // Dos envíos a la vez de la misma lista: el otro ya lo anotó.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "YA_TENIA";
    throw error;
  }
}

function depsPorDefecto(): InvitacionDeps {
  return {
    cargarCurso: (workspaceId, courseId) =>
      prisma.course.findFirst({
        where: { id: courseId, workspaceId, deliveryMode: "RECORDED" },
        select: { id: true, title: true, accessMonths: true, workspaceId: true },
      }),
    asegurarCuenta: (email) => asegurarCuentaDelAlumno(email),
    yaTieneAcceso: async (userId, courseId) =>
      (await prisma.courseAccess.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true },
      })) !== null,
    darAcceso: darAccesoEnBase,
    crearEnlaceContrasena: (userId, base) => crearEnlaceParaContrasena(userId, base),
    enviar: (mensaje) => sendTransactionalEmail(mensaje),
    cargarFirma: loadWorkspaceSignature,
    cargarRemitente: loadWorkspaceSender,
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    base: appUrl(),
    ahora: () => new Date(),
  };
}

export async function invitarSinCargo(
  input: InvitacionInput,
  deps: InvitacionDeps = depsPorDefecto(),
): Promise<{ ok: true; resultados: ResultadoInvitado[] } | { ok: false; error: string }> {
  if (!deps.base) return { ok: false, error: "Falta configurar la dirección de FOTOFFICE para armar los enlaces." };
  const curso = await deps.cargarCurso(input.workspaceId, input.courseId);
  if (!curso) return { ok: false, error: "Sólo se puede invitar a un curso grabado de este espacio." };

  const [firma, remitente] = await Promise.all([
    deps.cargarFirma(input.workspaceId).catch(() => null),
    deps.cargarRemitente(input.workspaceId).catch(() => null),
  ]);

  const resultados: ResultadoInvitado[] = [];
  let enviados = 0;
  for (const invitado of input.invitados) {
    try {
      const cuenta = await deps.asegurarCuenta(invitado.email);
      if (!cuenta) {
        resultados.push({ email: invitado.email, estado: "CORREO_INVALIDO" });
        continue;
      }
      if (await deps.yaTieneAcceso(cuenta.userId, curso.id)) {
        resultados.push({ email: invitado.email, estado: "YA_TENIA" });
        continue;
      }
      const expiresAt = calcularVencimiento(deps.ahora(), curso.accessMonths);
      if ((await deps.darAcceso({ curso, invitado, userId: cuenta.userId, expiresAt })) === "YA_TENIA") {
        resultados.push({ email: invitado.email, estado: "YA_TENIA" });
        continue;
      }

      const base = deps.base.replace(/\/+$/, "");
      const { html, text } = buildInvitacionSinCargoEmailBody(
        {
          studentName: invitado.nombre,
          courseTitle: curso.title,
          mensaje: input.mensaje,
          crearContrasenaUrl: cuenta.puedeEntrar ? null : await deps.crearEnlaceContrasena(cuenta.userId, base),
          loginUrl: `${base}/login?next=/portal/cursos`,
          portalUrl: `${base}/portal/cursos`,
          expiresAt,
        },
        firma,
      );
      if (enviados > 0) await deps.esperar(ESPERA_ENTRE_CORREOS_MS);
      enviados += 1;
      const envio = await deps.enviar({ to: invitado.email, subject: input.asunto, html, text, sender: remitente });
      // El acceso queda dado aunque el correo falle: con "Olvidé mi contraseña" igual entra.
      resultados.push(
        envio.status === "SENT"
          ? { email: invitado.email, estado: "INVITADO" }
          : { email: invitado.email, estado: "CORREO_NO_ENVIADO", detalle: envio.detail },
      );
    } catch (error) {
      resultados.push({
        email: invitado.email,
        estado: "ERROR",
        detalle: error instanceof Error ? error.message : "desconocido",
      });
    }
  }

  logCourseEvent("invitacion_sin_cargo", {
    workspaceId: input.workspaceId,
    courseId: curso.id,
    invitados: resultados.filter((r) => r.estado === "INVITADO").length,
    total: resultados.length,
  });
  return { ok: true, resultados };
}
