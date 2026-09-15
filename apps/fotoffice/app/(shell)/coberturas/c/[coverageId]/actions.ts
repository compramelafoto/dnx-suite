"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import { perfilHabilitado } from "@/lib/coverages/colaboradores";
import type { EstadoDeRol } from "@/lib/coverages/cupos";
import {
  planPublicarConvocatoria,
  puedeCrearseConvocatoria,
  puedeEditarseConvocatoria,
} from "@/lib/coverages/convocatoria";
import {
  ConflictoDeEquipo,
  planInvitacionDirecta,
  planSeleccionarPostulacion,
} from "@/lib/coverages/equipo";
import { aplicarEfectosSobreLaBusqueda } from "@/lib/coverages/equipo-server";
import { recordEvent } from "@/lib/coverages/events";
import { ASSIGNMENT_LIVE_STATUSES } from "@/lib/coverages/states";

export type ConvocatoriaState = { error: string | null; ok: string | null };

const VISIBILITY_OPTIONS = new Set(["TODOS", "POR_ZONA", "POR_ESPECIALIDAD"]);
const URGENCY_OPTIONS = new Set(["NORMAL", "ALTA", "URGENTE"]);

/** Una lista escrita "una por línea" o separada por comas, como en el resto del módulo. */
function lista(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Los campos comunes a crear y editar, parseados y acotados a las opciones válidas.
 *
 * El `<select>` del formulario es una comodidad para quien lo completa, no el control: lo que
 * no está en las opciones válidas cae en el valor más conservador, igual que ya hace
 * `normalizarAssignmentMode` en `lib/coverages/settings.ts`.
 */
function parseCamposConvocatoria(formData: FormData) {
  const title = formData.get("title")?.toString()?.trim();
  const publicSummary = formData.get("publicSummary")?.toString()?.trim() || null;
  const privateBriefing = formData.get("privateBriefing")?.toString()?.trim() || null;
  const visibilityRaw = formData.get("visibility")?.toString() ?? "TODOS";
  const visibility = VISIBILITY_OPTIONS.has(visibilityRaw) ? visibilityRaw : "TODOS";
  const visibilityValues = lista(formData.get("visibilityValues")?.toString());
  const urgencyRaw = formData.get("urgency")?.toString() ?? "NORMAL";
  const urgency = URGENCY_OPTIONS.has(urgencyRaw) ? urgencyRaw : "NORMAL";

  const closeRaw = formData.get("applicationsCloseAt")?.toString();
  let applicationsCloseAt: Date | null = null;
  if (closeRaw) {
    const d = new Date(closeRaw);
    if (Number.isNaN(d.getTime())) return { ok: false as const, error: "Esa fecha de cierre no es válida." };
    applicationsCloseAt = d;
  }

  if (!title) return { ok: false as const, error: "Ponele un título a la convocatoria." };

  return {
    ok: true as const,
    data: { title, publicSummary, privateBriefing, visibility, visibilityValues, urgency, applicationsCloseAt },
  };
}

/**
 * Crear la convocatoria de una cobertura, en `BORRADOR`.
 *
 * `CoverageCall.coverageId` es `@unique`: si ya existiera una, `puedeCrearseConvocatoria` lo
 * frena con un mensaje legible antes de que el `create` choque contra el índice.
 */
export async function crearConvocatoriaAction(
  _prev: ConvocatoriaState | undefined,
  formData: FormData,
): Promise<ConvocatoriaState> {
  const { workspace } = await requireCoveragesCoordinator();
  const coverageId = formData.get("coverageId")?.toString() ?? "";

  const campos = parseCamposConvocatoria(formData);
  if (!campos.ok) return { error: campos.error, ok: null };

  const cobertura = await prisma.coverage.findFirst({
    where: { id: coverageId, workspaceId: workspace.id },
    select: { id: true, status: true, call: { select: { id: true } } },
  });
  if (!cobertura) return { error: "No encontramos esa cobertura.", ok: null };

  const plan = puedeCrearseConvocatoria({
    coverageStatus: cobertura.status,
    yaExiste: Boolean(cobertura.call),
  });
  if (!plan.ok) return { error: plan.error, ok: null };

  await prisma.coverageCall.create({
    data: {
      workspaceId: workspace.id,
      coverageId: cobertura.id,
      status: "BORRADOR",
      ...campos.data,
    },
  });

  revalidatePath(`/coberturas/c/${cobertura.id}`);
  return {
    error: null,
    ok: "Creada como borrador. Revisala y publicala cuando esté lista.",
  };
}

/** Editar la convocatoria mientras sigue en `BORRADOR`. Publicada, se edita desde otro lado. */
export async function editarConvocatoriaAction(
  _prev: ConvocatoriaState | undefined,
  formData: FormData,
): Promise<ConvocatoriaState> {
  const { workspace } = await requireCoveragesCoordinator();
  const callId = formData.get("callId")?.toString() ?? "";

  const campos = parseCamposConvocatoria(formData);
  if (!campos.ok) return { error: campos.error, ok: null };

  const call = await prisma.coverageCall.findFirst({
    where: { id: callId, workspaceId: workspace.id },
    select: { id: true, status: true, coverageId: true },
  });
  if (!call) return { error: "No encontramos esa convocatoria.", ok: null };
  if (!puedeEditarseConvocatoria(call.status)) {
    return { error: "Ya se publicó: no se puede editar desde acá.", ok: null };
  }

  await prisma.coverageCall.update({ where: { id: call.id }, data: campos.data });

  revalidatePath(`/coberturas/c/${call.coverageId}`);
  return { error: null, ok: "Guardado." };
}

/**
 * Publicar la convocatoria: pasa a `PUBLICADA` y la cobertura a `BUSCANDO_EQUIPO`, en la misma
 * transacción, con un evento de historial para cada una (ver el plan, Tarea 5).
 */
export async function publicarConvocatoriaAction(
  _prev: ConvocatoriaState | undefined,
  formData: FormData,
): Promise<ConvocatoriaState> {
  const { user, workspace } = await requireCoveragesCoordinator();
  const callId = formData.get("callId")?.toString() ?? "";

  const call = await prisma.coverageCall.findFirst({
    where: { id: callId, workspaceId: workspace.id },
    include: {
      coverage: {
        select: {
          status: true,
          roles: { select: { vacancies: true, assignments: { select: { status: true } } } },
        },
      },
    },
  });

  const estadoRoles: EstadoDeRol[] = (call?.coverage.roles ?? []).map((r) => ({
    vacancies: r.vacancies,
    asignadasVivas: r.assignments.filter((a) =>
      (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
    ).length,
    asignadasAceptadas: 0, // no la usa `puedePublicarse`; se completa igual por el tipo
  }));

  const plan = planPublicarConvocatoria({
    call,
    coverage: call?.coverage ?? { status: "" },
    roles: estadoRoles,
    workspaceId: workspace.id,
  });
  if (!plan.ok) return { error: plan.error, ok: null };
  // El plan ya garantiza que `call` no es null; este chequeo es solo para que TypeScript lo sepa.
  if (!call) return { error: "No encontramos esa convocatoria.", ok: null };

  await prisma.$transaction(async (tx) => {
    await tx.coverageCall.update({
      where: { id: call.id },
      data: { status: "PUBLICADA", publishedAt: new Date() },
    });
    await tx.coverage.update({
      where: { id: call.coverageId },
      data: { status: "BUSCANDO_EQUIPO" },
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "CALL",
      entityId: call.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: call.status,
      toStatus: "PUBLICADA",
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "COVERAGE",
      entityId: call.coverageId,
      type: "ESTADO_CAMBIADO",
      fromStatus: call.coverage.status,
      toStatus: "BUSCANDO_EQUIPO",
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
    });
  });

  revalidatePath(`/coberturas/c/${call.coverageId}`);
  revalidatePath("/coberturas");
  return { error: null, ok: "Publicada. Ya se puede ver y postularse." };
}

export type EquipoState = { error: string | null; ok: string | null };

/**
 * Cuántas asignaciones vivas tiene este rol, contadas contra la base en este instante.
 *
 * **Una vacante no se puede asignar dos veces.** Dos coordinadores con la misma pantalla
 * abierta es un caso real, y lo que uno ve pintado en su navegador puede tener minutos de
 * viejo. Por eso el cupo se cuenta ADENTRO de la transacción y no se confía en lo que trajo la
 * pantalla.
 *
 * Ese recuento no es una garantía absoluta —Postgres en `READ COMMITTED` deja que dos
 * transacciones simultáneas cuenten lo mismo antes de que ninguna escriba— y por eso no es la
 * única barrera: `CoverageAssignment` tiene `@@unique([coverageId, memberId])`, que frena de
 * verdad el caso que más duele, la misma persona asignada dos veces a la misma cobertura. Lo
 * que el recuento cubre es el caso común y el que se puede explicar: el lugar se ocupó mientras
 * mirabas la pantalla.
 */
async function contarAsignadasVivas(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; roleId: string },
): Promise<number> {
  return tx.coverageAssignment.count({
    where: {
      roleId: input.roleId,
      status: { in: [...ASSIGNMENT_LIVE_STATUSES] },
      coverage: { workspaceId: input.workspaceId },
    },
  });
}

/** Si esta persona ya tiene una asignación viva en esta cobertura, en cualquiera de sus roles. */
async function yaEstaEnElEquipo(
  tx: Prisma.TransactionClient,
  input: { workspaceId: string; coverageId: string; memberId: string },
): Promise<boolean> {
  const fila = await tx.coverageAssignment.findFirst({
    where: {
      coverageId: input.coverageId,
      memberId: input.memberId,
      status: { in: [...ASSIGNMENT_LIVE_STATUSES] },
      coverage: { workspaceId: input.workspaceId },
    },
    select: { id: true },
  });
  return fila !== null;
}

/**
 * Seleccionar una postulación: la persona queda invitada y ahora espera su respuesta.
 *
 * Todo en una sola transacción: la postulación pasa a `SELECCIONADA`, nace la asignación en
 * `INVITADA` con `origin: "POSTULACION"`, se escriben los eventos de historial, y se recalcula
 * qué le pasa a la convocatoria y a la cobertura (ver `aplicarEfectosSobreLaBusqueda`).
 *
 * Para abortar con un mensaje legible se lanza `ConflictoDeEquipo`: devolver `{ ok: false }`
 * desde adentro del callback confirmaría igual lo que ya se hubiera escrito.
 *
 * El correo a la persona es de la tanda siguiente; la transición queda limpia justamente para
 * que engancharlo después sea agregar una llamada.
 */
export async function seleccionarPostulacionAction(
  _prev: EquipoState | undefined,
  formData: FormData,
): Promise<EquipoState> {
  const { user, workspace } = await requireCoveragesCoordinator();
  const applicationId = formData.get("applicationId")?.toString() ?? "";
  const actorLabel = user.name ?? user.email;

  let coverageIdParaRevalidar = "";

  try {
    await prisma.$transaction(async (tx) => {
      const postulacion = await tx.coverageApplication.findFirst({
        where: { id: applicationId, call: { workspaceId: workspace.id } },
        select: {
          id: true,
          status: true,
          memberId: true,
          roleId: true,
          role: {
            select: {
              id: true,
              vacancies: true,
              coverageId: true,
              coverage: { select: { status: true } },
            },
          },
        },
      });
      if (!postulacion) throw new ConflictoDeEquipo("No encontramos esa postulación.");
      coverageIdParaRevalidar = postulacion.role.coverageId;

      const asignadasVivas = await contarAsignadasVivas(tx, {
        workspaceId: workspace.id,
        roleId: postulacion.roleId,
      });
      const yaEstaAsignado = await yaEstaEnElEquipo(tx, {
        workspaceId: workspace.id,
        coverageId: postulacion.role.coverageId,
        memberId: postulacion.memberId,
      });

      const plan = planSeleccionarPostulacion({
        coverageStatus: postulacion.role.coverage.status,
        applicationStatus: postulacion.status,
        yaEstaAsignado,
        rol: {
          vacancies: postulacion.role.vacancies,
          asignadasVivas,
          asignadasAceptadas: 0, // `rolCompleto` no la mira: el lugar se ocupa al invitar
        },
      });
      if (!plan.ok) throw new ConflictoDeEquipo(plan.error);

      await tx.coverageApplication.update({
        where: { id: postulacion.id },
        data: { status: "SELECCIONADA" },
      });
      await recordEvent(tx, {
        workspaceId: workspace.id,
        entityType: "APPLICATION",
        entityId: postulacion.id,
        type: "ESTADO_CAMBIADO",
        fromStatus: postulacion.status,
        toStatus: "SELECCIONADA",
        actorUserId: user.id,
        actorLabel,
      });

      const asignacion = await tx.coverageAssignment.create({
        data: {
          coverageId: postulacion.role.coverageId,
          roleId: postulacion.roleId,
          memberId: postulacion.memberId,
          origin: "POSTULACION",
          assignedByUserId: user.id,
          status: "INVITADA",
        },
      });
      await recordEvent(tx, {
        workspaceId: workspace.id,
        entityType: "ASSIGNMENT",
        entityId: asignacion.id,
        type: "CREADA",
        toStatus: "INVITADA",
        actorUserId: user.id,
        actorLabel,
      });

      await aplicarEfectosSobreLaBusqueda(tx, {
        workspaceId: workspace.id,
        coverageId: postulacion.role.coverageId,
        actorUserId: user.id,
        actorLabel,
      });
    });
  } catch (error) {
    if (error instanceof ConflictoDeEquipo) return { error: error.message, ok: null };
    // El índice único `(coverageId, memberId)`: esa persona entró al equipo desde otra pantalla
    // entre el recuento y la escritura. Es la carrera que el recuento no llega a cubrir, y se
    // traduce al mismo aviso legible en vez de a un error de sistema.
    return { error: "Esa persona ya está en el equipo de esta cobertura.", ok: null };
  }

  revalidatePath(`/coberturas/c/${coverageIdParaRevalidar}`);
  return { error: null, ok: "Le mandamos la invitación. Ahora esperamos su respuesta." };
}

/**
 * Invitar directo a un colaborador activo que no se postuló.
 *
 * Mismo apretón de manos que al seleccionar una postulación —la asignación nace en `INVITADA` y
 * la persona todavía tiene que contestar—, con `origin: "INVITACION_DIRECTA"` para que el
 * historial distinga a quien se ofreció de a quien salimos a buscar.
 */
export async function invitarDirectoAction(
  _prev: EquipoState | undefined,
  formData: FormData,
): Promise<EquipoState> {
  const { user, workspace } = await requireCoveragesCoordinator();
  const roleId = formData.get("roleId")?.toString() ?? "";
  const memberId = formData.get("memberId")?.toString() ?? "";
  const criteria = formData.get("criteria")?.toString().trim() || null;
  const actorLabel = user.name ?? user.email;

  if (!memberId) return { error: "Elegí a quién querés invitar.", ok: null };

  let coverageIdParaRevalidar = "";

  try {
    await prisma.$transaction(async (tx) => {
      // El rol tiene que ser de una cobertura de ESTE workspace, y el filtro va en la consulta
      // y no en un chequeo posterior: un `roleId` ajeno llegado a mano en el `FormData`
      // simplemente no aparece.
      const rol = await tx.coverageRole.findFirst({
        where: { id: roleId, coverage: { workspaceId: workspace.id } },
        select: {
          id: true,
          vacancies: true,
          coverageId: true,
          coverage: { select: { status: true } },
        },
      });
      if (!rol) throw new ConflictoDeEquipo("No encontramos ese rol.");
      coverageIdParaRevalidar = rol.coverageId;

      // El socio también tiene que ser de este workspace y tener perfil de colaborador activo.
      // Un `memberId` de otra institución vuelve `null` acá y cae en el mismo mensaje que
      // alguien sin perfil: la pantalla ofrece solo los colaboradores activos del propio
      // padrón, pero eso es cortesía, no el control.
      const socio = await tx.member.findFirst({
        where: { id: memberId, workspaceId: workspace.id },
        select: { id: true, coverageProfile: { select: { active: true } } },
      });

      const asignadasVivas = await contarAsignadasVivas(tx, {
        workspaceId: workspace.id,
        roleId: rol.id,
      });
      const yaEstaAsignado = socio
        ? await yaEstaEnElEquipo(tx, {
            workspaceId: workspace.id,
            coverageId: rol.coverageId,
            memberId: socio.id,
          })
        : false;

      const plan = planInvitacionDirecta({
        coverageStatus: rol.coverage.status,
        tienePerfilActivo: perfilHabilitado(socio?.coverageProfile),
        yaEstaAsignado,
        rol: { vacancies: rol.vacancies, asignadasVivas, asignadasAceptadas: 0 },
      });
      if (!plan.ok) throw new ConflictoDeEquipo(plan.error);

      const asignacion = await tx.coverageAssignment.create({
        data: {
          coverageId: rol.coverageId,
          roleId: rol.id,
          memberId,
          origin: "INVITACION_DIRECTA",
          assignedByUserId: user.id,
          criteria,
          status: "INVITADA",
        },
      });
      await recordEvent(tx, {
        workspaceId: workspace.id,
        entityType: "ASSIGNMENT",
        entityId: asignacion.id,
        type: "CREADA",
        toStatus: "INVITADA",
        actorUserId: user.id,
        actorLabel,
        note: criteria,
      });

      await aplicarEfectosSobreLaBusqueda(tx, {
        workspaceId: workspace.id,
        coverageId: rol.coverageId,
        actorUserId: user.id,
        actorLabel,
      });
    });
  } catch (error) {
    if (error instanceof ConflictoDeEquipo) return { error: error.message, ok: null };
    return { error: "Esa persona ya está en el equipo de esta cobertura.", ok: null };
  }

  revalidatePath(`/coberturas/c/${coverageIdParaRevalidar}`);
  return { error: null, ok: "La invitamos. Ahora esperamos su respuesta." };
}
