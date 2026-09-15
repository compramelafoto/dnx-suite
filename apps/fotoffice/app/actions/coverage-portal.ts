"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { loadCollaboratorProfile } from "@/lib/coverages/repository";
import { perfilHabilitado } from "@/lib/coverages/colaboradores";
import { puedePostularse, type CandidatoAConvocatoria } from "@/lib/coverages/elegibilidad";
import {
  ConflictoDeEquipo,
  YA_RESPONDIDA,
  planResponderInvitacion,
} from "@/lib/coverages/equipo";
import { aplicarEfectosSobreLaBusqueda } from "@/lib/coverages/equipo-server";
import { ASSIGNMENT_LIVE_STATUSES } from "@/lib/coverages/states";
import { assertAssignmentTransition } from "@/lib/coverages/transitions";
import { recordEvent } from "@/lib/coverages/events";

export type PostularseState = { error: string | null; ok: string | null };

/**
 * Un voluntario se postula a un rol de una convocatoria.
 *
 * Es voluntariado, no un trámite: los mensajes son los amables que ya define
 * `lib/coverages/elegibilidad.ts`, no un genérico "no cumplís los requisitos".
 *
 * **Todo se vuelve a mirar acá con los datos de este instante.** La pantalla esconde el botón
 * por cortesía cuando ya no corresponde postularse, pero eso no es el control — dos pestañas
 * abiertas es un caso real (ver el plan), y `puedePostularse` es la única fuente de verdad sobre
 * quién puede anotarse. Esta función solo arma, fresco, lo que esa función pura necesita.
 */
export async function postularseAction(
  _prev: PostularseState | undefined,
  formData: FormData,
): Promise<PostularseState> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) return { error: "No encontramos tu ficha de socio.", ok: null };

  if (!(await isModuleEnabledForWorkspace(context.workspace.id, COVERAGES_MODULE_KEY))) {
    return { error: "Este módulo no está disponible.", ok: null };
  }

  const callId = formData.get("callId")?.toString() ?? "";
  const roleId = formData.get("roleId")?.toString() ?? "";
  const message = formData.get("message")?.toString().trim() || null;

  // El rol tiene que pertenecer a una convocatoria de ESTE workspace y con ESTE id: el filtro va
  // en la misma consulta, no en un chequeo aparte después de traerla — un roleId ajeno o de otra
  // convocatoria simplemente no aparece.
  const rol = await prisma.coverageRole.findFirst({
    where: {
      id: roleId,
      coverage: { call: { id: callId, workspaceId: context.workspace.id } },
    },
    select: {
      id: true,
      coverageId: true,
      coverage: {
        select: {
          call: { select: { id: true, status: true, applicationsCloseAt: true } },
        },
      },
    },
  });
  if (!rol || !rol.coverage.call) {
    return { error: "No encontramos esa convocatoria.", ok: null };
  }
  const call = rol.coverage.call;

  const [perfil, postulacionExistente, asignacionViva] = await Promise.all([
    loadCollaboratorProfile({ workspaceId: context.workspace.id, memberId: context.member.id }),
    prisma.coverageApplication.findUnique({
      where: { roleId_memberId: { roleId: rol.id, memberId: context.member.id } },
      select: { id: true },
    }),
    prisma.coverageAssignment.findFirst({
      where: {
        coverageId: rol.coverageId,
        memberId: context.member.id,
        status: { in: [...ASSIGNMENT_LIVE_STATUSES] },
      },
      select: { id: true },
    }),
  ]);

  const candidato: CandidatoAConvocatoria = {
    tienePerfilActivo: perfilHabilitado(perfil),
    yaSePostulo: postulacionExistente !== null,
    yaEstaAsignado: asignacionViva !== null,
    convocatoriaStatus: call.status,
    cierreDePostulaciones: call.applicationsCloseAt,
  };

  const elegibilidad = puedePostularse(candidato, new Date());
  if (!elegibilidad.puede) return { error: elegibilidad.motivo, ok: null };

  const nombre = `${context.member.firstName} ${context.member.lastName}`.trim();

  try {
    await prisma.$transaction(async (tx) => {
      const postulacion = await tx.coverageApplication.create({
        data: {
          callId: call.id,
          roleId: rol.id,
          memberId: context.member.id,
          message,
          status: "RECIBIDA",
        },
      });
      await recordEvent(tx, {
        workspaceId: context.workspace.id,
        entityType: "APPLICATION",
        entityId: postulacion.id,
        type: "CREADA",
        toStatus: "RECIBIDA",
        actorUserId: user.id,
        actorLabel: nombre,
      });
    });
  } catch {
    // La carrera que el comentario de arriba anticipa, de verdad: entre que se pintó la
    // pantalla y que se apretó el botón, esta misma persona ya quedó anotada desde otra
    // pestaña. El índice único de `CoverageApplication` (roleId, memberId) es quien la frena
    // de verdad; acá solo se traduce ese choque a un aviso que se entiende.
    return { error: "Ya te anotaste.", ok: null };
  }

  revalidatePath("/portal/coberturas");
  revalidatePath(`/portal/coberturas/${callId}`);

  return { error: null, ok: "¡Listo! Quedaste anotado. La coordinación te va a avisar." };
}

/**
 * `aviso` no es un error: es lo que se le dice a quien ya había contestado.
 *
 * Va por un campo propio para que la pantalla lo muestre en gris y no en rojo. Apretar el botón
 * dos veces en el teléfono, o volver al enlace de WhatsApp al día siguiente, no es culpa de
 * nadie y no tiene por qué parecer una falla.
 */
export type ResponderInvitacionState = {
  error: string | null;
  ok: string | null;
  aviso: string | null;
};

/**
 * Confirmar la invitación, o avisar que no se puede.
 *
 * **Nadie responde la invitación de otro.** La consulta filtra por `memberId` —el de la sesión,
 * nunca uno que venga del formulario— y por `workspaceId`, los dos en el mismo `where`: una
 * invitación ajena no aparece, y el mensaje es el mismo que cuando el id no existe. Así la
 * respuesta no cuenta si esa invitación existe o no.
 *
 * El cambio de estado se escribe con un `updateMany` que exige `status: "INVITADA"` en su
 * propio `where`, y no con un `update` después de haberlo leído: entre la lectura y la
 * escritura hay una ventana, y en esa ventana entra justo el segundo toque del botón. Si el
 * `updateMany` no tocó ninguna fila es que alguien —esta misma persona desde otra pestaña, o la
 * coordinación cancelando la asignación— ya la movió, y entonces se avisa con calma en vez de
 * pisar la respuesta anterior.
 *
 * Al confirmar o al rechazar se recalcula qué le pasa a la convocatoria y a la cobertura, en la
 * misma transacción (ver `aplicarEfectosSobreLaBusqueda`): un rechazo devuelve el lugar libre,
 * así que la convocatoria vuelve a `PUBLICADA` y la cobertura a `BUSCANDO_EQUIPO`. Sin eso, un
 * rechazo deja la cobertura sin equipo y nadie se entera.
 */
export async function responderInvitacionAction(
  _prev: ResponderInvitacionState | undefined,
  formData: FormData,
): Promise<ResponderInvitacionState> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) return { error: "No encontramos tu ficha de socio.", ok: null, aviso: null };

  if (!(await isModuleEnabledForWorkspace(context.workspace.id, COVERAGES_MODULE_KEY))) {
    return { error: "Este módulo no está disponible.", ok: null, aviso: null };
  }

  const assignmentId = formData.get("assignmentId")?.toString() ?? "";
  const respuesta = formData.get("respuesta")?.toString() ?? "";

  const asignacion = await prisma.coverageAssignment.findFirst({
    where: {
      id: assignmentId,
      memberId: context.member.id,
      coverage: { workspaceId: context.workspace.id },
    },
    select: { id: true, status: true, coverageId: true },
  });
  // Mismo mensaje para "no existe" y para "no es tuya": la respuesta no revela cuál de las dos.
  if (!asignacion) {
    return { error: "No encontramos esa invitación.", ok: null, aviso: null };
  }

  const plan = planResponderInvitacion({
    assignmentStatus: asignacion.status,
    respuesta,
  });
  if (!plan.ok) {
    return plan.yaRespondida
      ? { error: null, ok: null, aviso: plan.aviso }
      : { error: plan.error, ok: null, aviso: null };
  }

  const transicion = assertAssignmentTransition({
    from: asignacion.status,
    to: plan.nuevoEstado,
  });
  if (!transicion.ok) return { error: transicion.error, ok: null, aviso: null };

  const nombre = `${context.member.firstName} ${context.member.lastName}`.trim();
  const ahora = new Date();
  const confirma = plan.nuevoEstado === "CONFIRMADA";

  try {
    await prisma.$transaction(async (tx) => {
      const tocadas = await tx.coverageAssignment.updateMany({
        where: { id: asignacion.id, memberId: context.member.id, status: "INVITADA" },
        data: {
          status: plan.nuevoEstado,
          respondedAt: ahora,
          confirmedAt: confirma ? ahora : null,
        },
      });
      if (tocadas.count === 0) throw new ConflictoDeEquipo(YA_RESPONDIDA);

      await recordEvent(tx, {
        workspaceId: context.workspace.id,
        entityType: "ASSIGNMENT",
        entityId: asignacion.id,
        type: "ESTADO_CAMBIADO",
        fromStatus: asignacion.status,
        toStatus: plan.nuevoEstado,
        actorUserId: user.id,
        actorLabel: nombre,
      });

      await aplicarEfectosSobreLaBusqueda(tx, {
        workspaceId: context.workspace.id,
        coverageId: asignacion.coverageId,
        actorUserId: user.id,
        actorLabel: nombre,
      });
    });
  } catch (error) {
    if (error instanceof ConflictoDeEquipo) {
      return { error: null, ok: null, aviso: error.message };
    }
    throw error;
  }

  revalidatePath("/portal/coberturas");
  revalidatePath(`/portal/coberturas/asignacion/${asignacion.id}`);

  return {
    error: null,
    ok: confirma
      ? "¡Gracias! Tu lugar en el equipo quedó confirmado. Nos vemos ese día."
      : "Gracias por avisarnos. Dejamos tu lugar libre para otra persona.",
    aviso: null,
  };
}
