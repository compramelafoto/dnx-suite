"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { requireAuth } from "@/lib/auth";
import { COVERAGE_EMAIL_KEYS } from "@/lib/communications/constants";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import {
  loadCollaboratorProfile,
  loadSettings,
  loadWorkspaceContactEmail,
} from "@/lib/coverages/repository";
import { perfilHabilitado } from "@/lib/coverages/colaboradores";
import {
  buildAssignmentConfirmedEmail,
  buildTeamCompleteEmail,
  destinatariosDeCoordinacion,
} from "@/lib/coverages/emails";
import { fechaHoraArgentina } from "@/lib/coverages/format";
import { puedePostularse, type CandidatoAConvocatoria } from "@/lib/coverages/elegibilidad";
import {
  ConflictoDeEquipo,
  YA_RESPONDIDA,
  planResponderInvitacion,
} from "@/lib/coverages/equipo";
import {
  aplicarEfectosSobreLaBusqueda,
  prepararAvisoDeEquipoCompleto,
  type AvisoDeEquipoCompleto,
} from "@/lib/coverages/equipo-server";
import { ASSIGNMENT_LIVE_STATUSES } from "@/lib/coverages/states";
import {
  assertApplicationTransition,
  assertAssignmentTransition,
} from "@/lib/coverages/transitions";
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
    // aislamiento: por `rol.id`, que se leyó filtrando por la convocatoria de este workspace,
    // y por el `memberId` de la sesión.
    prisma.coverageApplication.findUnique({
      where: { roleId_memberId: { roleId: rol.id, memberId: context.member.id } },
      select: { id: true },
    }),
    // aislamiento: por `rol.coverageId`, ya verificado arriba, y por el `memberId` de la sesión.
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
      // aislamiento: `CoverageApplication` no tiene columna de workspace; la cuelga `callId`, que
      // es la convocatoria ya verificada contra este workspace.
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
  } catch (error) {
    // **Solo el choque del índice único significa "ya te anotaste".** Atrapar cualquier error y
    // decir siempre lo mismo hacía que, con la base caída un segundo, Juan leyera «Ya te
    // anotaste.» y se quedara tranquilo mientras su postulación no existía y nadie lo iba a
    // llamar. Un mensaje amable que afirma algo falso es peor que un error.
    //
    // P2002 sí es la carrera que el comentario de arriba anticipa: entre que se pintó la pantalla
    // y que se apretó el botón, esta misma persona ya quedó anotada desde otra pestaña. El índice
    // único de `CoverageApplication` (roleId, memberId) es quien la frena de verdad.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ya te anotaste.", ok: null };
    }
    console.error("[fotoffice][coberturas] no se pudo guardar la postulación", {
      callId: call.id,
      roleId: rol.id,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return { error: "No pudimos guardar tu respuesta. Probá de nuevo.", ok: null };
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
    // El rol y la cobertura son para el aviso a la coordinación: "confirmó Ana, como fotógrafa
    // principal, para la jornada del sábado". Un identificador no le dice nada a nadie.
    select: {
      id: true,
      status: true,
      coverageId: true,
      // `origin` y `roleId` son para poder cerrar la postulación de la que salió esta invitación
      // cuando la persona avisa que no puede (ver `retirarPostulacionDeLaInvitacion`).
      origin: true,
      roleId: true,
      role: { select: { name: true } },
      coverage: { select: { title: true, startsAt: true } },
    },
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

  /**
   * Todo lo del correo a la organización solicitante se decide ANTES de abrir la transacción.
   *
   * Ese correo rota el enlace de seguimiento, y rotar es irreversible: si no hay a quién
   * mandárselo o no hay con qué armar el enlace, rotar dejaría a la organización sin ningún
   * enlace vivo (ver `prepararAvisoDeEquipoCompleto`). Solo hace falta al confirmar: un "no
   * puedo" nunca completa un equipo.
   */
  const aviso = confirma
    ? await prepararAvisoDeEquipoCompleto({
        workspaceId: context.workspace.id,
        coverageId: asignacion.coverageId,
      })
    : null;

  let equipoQuedoConfirmado = false;

  try {
    await prisma.$transaction(async (tx) => {
      // aislamiento: por `asignacion.id`, leída arriba con `coverage: { workspaceId }`, y por el
      // `memberId` de la sesión, que viaja otra vez con la escritura.
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

      if (!confirma) {
        await retirarPostulacionDeLaInvitacion(tx, {
          workspaceId: context.workspace.id,
          origin: asignacion.origin,
          roleId: asignacion.roleId,
          memberId: context.member.id,
          actorUserId: user.id,
          actorLabel: nombre,
        });
      }

      const efectos = await aplicarEfectosSobreLaBusqueda(tx, {
        workspaceId: context.workspace.id,
        coverageId: asignacion.coverageId,
        actorUserId: user.id,
        actorLabel: nombre,
        avisoDeEquipoCompleto: aviso,
      });
      // Si fue ESTA respuesta la que completó el equipo, el enlace nuevo ya quedó escrito acá
      // adentro y el correo sale afuera, con la transacción cerrada.
      equipoQuedoConfirmado = efectos.coverageStatus === "EQUIPO_CONFIRMADO";
    });
  } catch (error) {
    if (error instanceof ConflictoDeEquipo) {
      return { error: null, ok: null, aviso: error.message };
    }
    throw error;
  }

  /**
   * Los dos correos salen DESPUÉS de que la transacción cerró, y ninguno puede voltearla.
   *
   * Si el proveedor de correo está caído, esta persona confirmó igual: el estado ya quedó bien y
   * `sendAndLogEmail` deja registrado el intento. Por eso tampoco se le devuelve ningún aviso de
   * fallo — que un correo interno no haya salido no es asunto de quien acaba de decir que sí, y
   * asustarla con un renglón rojo la haría dudar de si confirmó o no.
   */
  if (confirma) {
    await avisarConfirmacion({
      workspaceId: context.workspace.id,
      coverageId: asignacion.coverageId,
      coverageTitle: asignacion.coverage.title,
      startsAt: asignacion.coverage.startsAt,
      roleName: asignacion.role.name,
      personName: nombre,
      equipoCompleto: equipoQuedoConfirmado,
    });
  }

  if (equipoQuedoConfirmado && aviso) {
    await avisarEquipoCompleto(context.workspace.id, aviso);
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

/**
 * Cuando alguien avisa que no puede, su postulación se retira.
 *
 * Sin esto, la asignación quedaba `RECHAZADA` —el lugar se liberaba bien— pero la postulación se
 * quedaba en `SELECCIONADA` para siempre: en «Tus postulaciones» la persona leía "Seleccionada",
 * que es exactamente lo contrario de lo que acababa de hacer. Tampoco la alcanzaba el cierre
 * automático del final (`postulacionesQueSeCierran` solo toca los estados vivos, y `SELECCIONADA`
 * no lo es), así que ese renglón no se arreglaba nunca.
 *
 * `RETIRADA` y no `NO_SELECCIONADA` porque son dos hechos distintos: una es "el equipo se
 * completó sin vos", la otra es "no puedo". Decirle a alguien que no fue elegida cuando fue ella
 * la que avisó es contarle mal su propia historia.
 *
 * **En la misma transacción que la respuesta**: las dos filas cuentan el mismo hecho, y si una se
 * escribe sin la otra el portal vuelve a mentir.
 *
 * Solo cuando la invitación salió de una postulación. A quien se invitó directo no hay ninguna
 * postulación que cerrar, y buscarla igual sería buscar algo que no existe.
 */
async function retirarPostulacionDeLaInvitacion(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    origin: string;
    roleId: string;
    memberId: string;
    actorUserId: number | null;
    actorLabel: string | null;
  },
): Promise<void> {
  if (input.origin !== "POSTULACION") return;

  // El aislamiento va por la convocatoria, que es quien lleva el `workspaceId`:
  // `CoverageApplication` no tiene esa columna.
  const postulacion = await tx.coverageApplication.findFirst({
    where: {
      roleId: input.roleId,
      memberId: input.memberId,
      call: { workspaceId: input.workspaceId },
    },
    select: { id: true, status: true },
  });
  if (!postulacion) return;

  // La máquina de estados decide, no un `if` escrito acá. Y si ya estaba retirada —o cerrada por
  // otro camino—, no hay nada que hacer: esto no pisa una resolución anterior.
  if (!assertApplicationTransition({ from: postulacion.status, to: "RETIRADA" }).ok) return;

  // aislamiento: por `postulacion`, leída acá arriba con `call: { workspaceId }` en su where.
  await tx.coverageApplication.update({
    where: { id: postulacion.id },
    data: { status: "RETIRADA" },
  });
  await recordEvent(tx, {
    workspaceId: input.workspaceId,
    entityType: "APPLICATION",
    entityId: postulacion.id,
    type: "ESTADO_CAMBIADO",
    fromStatus: postulacion.status,
    toStatus: "RETIRADA",
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel,
  });
}

/**
 * El aviso interno de que alguien confirmó su lugar.
 *
 * Va a los correos de la configuración del módulo y, si no hay ninguno, al de contacto de la
 * institución (ver `destinatariosDeCoordinacion`). Sin nadie configurado no sale para nadie, y
 * eso se registra: una confirmación que nadie mira es peor que un correo que falló, porque
 * nadie la va a reclamar.
 */
async function avisarConfirmacion(input: {
  workspaceId: string;
  coverageId: string;
  coverageTitle: string;
  startsAt: Date;
  roleName: string;
  personName: string;
  equipoCompleto: boolean;
}): Promise<void> {
  const [settings, contactEmail] = await Promise.all([
    loadSettings(input.workspaceId),
    loadWorkspaceContactEmail({ workspaceId: input.workspaceId }),
  ]);

  const destinatarios = destinatariosDeCoordinacion({
    notifyEmails: settings.notifyEmails,
    contactEmail,
  });

  if (destinatarios.length === 0) {
    console.warn(
      `Confirmación de equipo en la cobertura ${input.coverageId} del workspace ` +
        `${input.workspaceId}: no hay a quién avisarle (ni notifyEmails ni contactEmail).`,
    );
    return;
  }

  const base = appUrl();
  for (const destino of destinatarios) {
    await sendAndLogEmail({
      to: destino,
      templateKey: COVERAGE_EMAIL_KEYS.ASSIGNMENT_CONFIRMED,
      body: buildAssignmentConfirmedEmail({
        coverageTitle: input.coverageTitle,
        personName: input.personName,
        roleName: input.roleName,
        fechaLabel: fechaHoraArgentina(input.startsAt),
        equipoCompleto: input.equipoCompleto,
        panelUrl: base ? `${base}/coberturas/c/${input.coverageId}` : "",
      }),
    });
  }
}

/**
 * "Ya tenemos el equipo", a la organización que pidió la cobertura.
 *
 * Sale una sola vez, cuando la cobertura llega a `EQUIPO_CONFIRMADO` —no cuando la convocatoria
 * se pone `COMPLETA`, que es apenas "dejamos de buscar"—. El enlace de seguimiento que lleva ya
 * se rotó dentro de la transacción; acá solo se manda.
 */
async function avisarEquipoCompleto(
  workspaceId: string,
  aviso: AvisoDeEquipoCompleto,
): Promise<void> {
  const contexto = await loadWorkspaceEmailContext(workspaceId);
  await sendAndLogEmail({
    to: aviso.destinatario,
    templateKey: COVERAGE_EMAIL_KEYS.TEAM_COMPLETE,
    body: buildTeamCompleteEmail({
      context: contexto,
      publicCode: aviso.publicCode,
      eventTitle: aviso.eventTitle,
      contactName: aviso.contactName,
      fechaLabel: aviso.fechaLabel,
      city: aviso.city,
      trackingUrl: aviso.trackingUrl,
    }),
  });
}
