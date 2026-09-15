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
import { ASSIGNMENT_LIVE_STATUSES } from "@/lib/coverages/states";
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
