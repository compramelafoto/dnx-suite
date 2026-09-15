"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { COVERAGE_EMAIL_KEYS } from "@/lib/communications/constants";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { direccionesConEnvioExitoso } from "@/lib/communications/sent-log";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import { enTandas, pendientesDeAviso } from "@/lib/coverages/avisos";
import { perfilHabilitado } from "@/lib/coverages/colaboradores";
import { CALL_NOTICE_BATCH_SIZE } from "@/lib/coverages/constants";
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
import {
  buildAssignmentInvitedEmail,
  buildCallPublishedEmail,
  destinatariosDeColaboradores,
} from "@/lib/coverages/emails";
import { aplicarEfectosSobreLaBusqueda } from "@/lib/coverages/equipo-server";
import { recordEvent } from "@/lib/coverages/events";
import { fechaArgentina, fechaHoraArgentina } from "@/lib/coverages/format";
import {
  countActiveCollaboratorEmails,
  listActiveCollaboratorEmails,
} from "@/lib/coverages/repository";
import { ASSIGNMENT_LIVE_STATUSES } from "@/lib/coverages/states";

/**
 * `warn` es para lo que salió a medias: el cambio se hizo pero el aviso no salió.
 *
 * Mismo tercer canal que ya usa el panel de solicitudes (ver `PanelState` en
 * `app/(shell)/coberturas/actions.ts`): sin él habría que elegir entre pintar de verde un fallo
 * o de rojo una publicación que sí ocurrió, y las dos cosas hacen que la coordinación actúe mal.
 */
export type ConvocatoriaState = { error: string | null; ok: string | null; warn?: string | null };

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

  // aislamiento: por `call`, leída arriba con `workspaceId` en su where.
  await prisma.coverageCall.update({ where: { id: call.id }, data: campos.data });

  revalidatePath(`/coberturas/c/${call.coverageId}`);
  return { error: null, ok: "Guardado." };
}

/**
 * Publicar la convocatoria: pasa a `PUBLICADA` y —si todavía no estaba buscando equipo— la
 * cobertura a `BUSCANDO_EQUIPO`, en la misma transacción, con un evento de historial para cada
 * una (ver el plan, Tarea 5).
 *
 * El "si todavía no estaba" no es una precaución teórica: una invitación directa mueve sola la
 * cobertura a `BUSCANDO_EQUIPO`, así que se puede llegar acá con la cobertura ya en ese estado
 * y no hay nada que mover. Lo decide `planPublicarConvocatoria`, no un `if` escrito acá.
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
          // Para el correo a los colaboradores: qué actividad es, cuándo y dónde.
          title: true,
          startsAt: true,
          city: true,
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

  // La fecha de publicación se toma acá, antes de escribirla, porque también es el "desde" de
  // los avisos: un reenvío pregunta qué salió a partir de este instante, y si la leyera de otro
  // reloj podría dejar afuera los envíos de esta misma corrida.
  const publishedAt = new Date();

  await prisma.$transaction(async (tx) => {
    // aislamiento: por `call`, leída antes de abrir la transacción filtrando por workspace.
    await tx.coverageCall.update({
      where: { id: call.id },
      data: { status: "PUBLICADA", publishedAt },
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
    if (plan.moverCobertura) {
      // aislamiento: `call.coverageId` viene de esa misma convocatoria, ya verificada.
      await tx.coverage.update({
        where: { id: call.coverageId },
        data: { status: "BUSCANDO_EQUIPO" },
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
    }
  });

  const resultado = await avisarConvocatoriaPublicada({
    workspaceId: workspace.id,
    callId: call.id,
    callTitle: call.title,
    publicSummary: call.publicSummary,
    coverageTitle: call.coverage.title,
    startsAt: call.coverage.startsAt,
    city: call.coverage.city,
    desde: publishedAt,
    // En la publicación no hay nada previo que saltear, y preguntarlo sería una consulta de
    // gusto. El reenvío es el que necesita saber qué ya salió.
    omitirYaAvisados: false,
  });

  revalidatePath(`/coberturas/c/${call.coverageId}`);
  revalidatePath("/coberturas");
  return {
    error: null,
    ok: "Publicada. Ya se puede ver y postularse.",
    warn: avisoDeAvisosQueFaltan(resultado, "Quedó publicada"),
  };
}

/**
 * Reenviar el aviso a quienes no lo recibieron.
 *
 * Sin esto, un envío a medias es irreparable desde el producto: el aviso de convocatoria sale
 * únicamente en la transición `BORRADOR → PUBLICADA`, que ya ocurrió, y el botón de publicar
 * desaparece. La coordinación leía "3 de los 50 avisos no salieron" y no tenía nada que hacer
 * con esa información.
 *
 * **Le escribe solamente a quien todavía no lo recibió**, leyendo `SentEmailLog` (ver
 * `direccionesConEnvioExitoso`). Se puede apretar las veces que haga falta: a nadie le llega dos
 * veces, y cuando ya salieron todos lo dice en vez de mandar nada.
 *
 * Solo sobre una convocatoria `PUBLICADA`: en borrador todavía no se avisó a nadie, y una
 * completa, cerrada, vencida o cancelada ya no busca gente — mandar "anotate" ahí sería llamar a
 * voluntarios a un lugar que ya no existe.
 */
export async function reenviarAvisoConvocatoriaAction(
  _prev: ConvocatoriaState | undefined,
  formData: FormData,
): Promise<ConvocatoriaState> {
  const { workspace } = await requireCoveragesCoordinator();
  const callId = formData.get("callId")?.toString() ?? "";

  const call = await prisma.coverageCall.findFirst({
    where: { id: callId, workspaceId: workspace.id },
    select: {
      id: true,
      title: true,
      publicSummary: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      coverageId: true,
      coverage: { select: { title: true, startsAt: true, city: true } },
    },
  });
  if (!call) return { error: "No encontramos esa convocatoria.", ok: null };
  if (call.status !== "PUBLICADA") {
    return { error: "El aviso se reenvía mientras la convocatoria está publicada.", ok: null };
  }

  const resultado = await avisarConvocatoriaPublicada({
    workspaceId: workspace.id,
    callId: call.id,
    callTitle: call.title,
    publicSummary: call.publicSummary,
    coverageTitle: call.coverage.title,
    startsAt: call.coverage.startsAt,
    city: call.coverage.city,
    // `publishedAt` es lo que acota la búsqueda en el registro a los envíos de ESTA corrida de
    // avisos. Si faltara —una convocatoria publicada antes de que se guardara esa fecha—, la
    // fecha de creación es el límite más viejo posible y sigue siendo correcto: nunca hubo un
    // aviso de esta convocatoria antes de que la convocatoria existiera.
    desde: call.publishedAt ?? call.createdAt,
    omitirYaAvisados: true,
  });

  revalidatePath(`/coberturas/c/${call.coverageId}`);

  if (resultado.intentados === 0) {
    return {
      error: null,
      ok: "No hacía falta: el aviso ya le había llegado a todos los colaboradores activos.",
      warn: avisoDeAvisosQueFaltan(resultado, "No hizo falta reenviar nada"),
    };
  }

  const salieron = resultado.intentados - resultado.fallaron;
  return {
    error: null,
    ok: `Reenviado a ${salieron} ${salieron === 1 ? "colaborador" : "colaboradores"}.`,
    warn: avisoDeAvisosQueFaltan(resultado, "Se reenvió"),
  };
}

/** Lo que dejó una corrida de avisos, para que quien llama lo cuente con sus palabras. */
type ResultadoDeAvisos = {
  /** Cuántos colaboradores activos con correo hay en el padrón, sin el techo del módulo. */
  enElPadron: number;
  /** A cuántos alcanzaba esta corrida: el padrón, recortado por `CALL_NOTICE_MAX_RECIPIENTS`. */
  alcanzados: number;
  /** A cuántos se les escribió ahora (los que faltaban, si se pidió omitir a los ya avisados). */
  intentados: number;
  fallaron: number;
};

/**
 * El aviso a los colaboradores activos de que hay una convocatoria nueva.
 *
 * **Un correo por persona, nunca en copia.** La dirección de un voluntario es un dato personal
 * suyo: repartirla entre los otros cuarenta colaboradores de la institución no es una
 * distracción de estilo, es filtrar datos de terceros. `destinatariosDeColaboradores` devuelve
 * una lista de direcciones sueltas justamente para que acá no haya forma de juntarlas.
 *
 * **Sale en tandas paralelas chicas, no uno detrás del otro.** Cincuenta envíos secuenciales son
 * quince segundos de espera dentro de una Server Action que ya confirmó su transacción: si la
 * función se corta ahí, la convocatoria quedó publicada y media institución no se enteró. En
 * tandas de `CALL_NOTICE_BATCH_SIZE` esa espera baja a unos pocos segundos, y el tope de
 * destinatarios garantiza que la corrida termine incluso en un padrón enorme.
 *
 * Sale DESPUÉS de que la transacción cerró, y ninguno de estos correos puede voltear la
 * publicación: `sendAndLogEmail` nunca lanza y cada envío queda registrado. Ese registro es lo
 * que hace reparable un envío a medias: con `omitirYaAvisados`, la corrida le escribe solamente
 * a quien todavía no lo recibió, y por eso se puede apretar «Reenviar» las veces que haga falta
 * sin que a nadie le llegue dos veces.
 */
async function avisarConvocatoriaPublicada(input: {
  workspaceId: string;
  callId: string;
  callTitle: string;
  publicSummary: string | null;
  coverageTitle: string;
  startsAt: Date;
  city: string | null;
  /** Desde cuándo cuentan los envíos ya registrados. La fecha de publicación de esta convocatoria. */
  desde: Date;
  /** `true` en el reenvío: saltea a quien ya tiene un envío exitoso registrado. */
  omitirYaAvisados: boolean;
}): Promise<ResultadoDeAvisos> {
  const [contexto, colaboradores, enElPadron] = await Promise.all([
    loadWorkspaceEmailContext(input.workspaceId),
    listActiveCollaboratorEmails({ workspaceId: input.workspaceId }),
    countActiveCollaboratorEmails({ workspaceId: input.workspaceId }),
  ]);

  const destinatarios = destinatariosDeColaboradores(colaboradores);
  const vacio = { enElPadron, alcanzados: destinatarios.length, intentados: 0, fallaron: 0 };
  if (destinatarios.length === 0) return vacio;

  // El nombre de pila para saludar a cada uno. La clave es el correo en minúsculas porque es
  // así como `destinatariosDeColaboradores` decide que dos filas son la misma persona.
  const nombrePorEmail = new Map<string, string>();
  for (const c of colaboradores) {
    const clave = c.email?.trim().toLowerCase();
    if (clave && !nombrePorEmail.has(clave)) nombrePorEmail.set(clave, c.firstName);
  }

  const base = appUrl();
  const callUrl = base ? `${base}/portal/coberturas/${input.callId}` : "";

  const cuerpoPara = (destino: string) =>
    buildCallPublishedEmail({
      context: contexto,
      greetingName: nombrePorEmail.get(destino.toLowerCase()) ?? null,
      callTitle: input.callTitle,
      coverageTitle: input.coverageTitle,
      fechaLabel: fechaHoraArgentina(input.startsAt),
      city: input.city,
      publicSummary: input.publicSummary,
      callUrl,
    });

  // El asunto no depende de a quién se le escribe —lleva el título de la convocatoria y el
  // nombre de la institución— y por eso sirve para reconocer, en `SentEmailLog`, los envíos de
  // ESTA convocatoria y no los de otra.
  const asunto = cuerpoPara(destinatarios[0]!).subject;

  const yaAvisados = input.omitirYaAvisados
    ? await direccionesConEnvioExitoso({
        templateKey: COVERAGE_EMAIL_KEYS.CALL_PUBLISHED,
        subject: asunto,
        desde: input.desde,
        candidatos: destinatarios,
      })
    : new Set<string>();

  const pendientes = pendientesDeAviso(destinatarios, yaAvisados);
  let fallaron = 0;
  for (const tanda of enTandas(pendientes, CALL_NOTICE_BATCH_SIZE)) {
    const resultados = await Promise.all(
      tanda.map((destino) =>
        sendAndLogEmail({
          to: destino,
          templateKey: COVERAGE_EMAIL_KEYS.CALL_PUBLISHED,
          body: cuerpoPara(destino),
        }),
      ),
    );
    fallaron += resultados.filter((r) => r.status !== "SENT").length;
  }

  return {
    enElPadron,
    alcanzados: destinatarios.length,
    intentados: pendientes.length,
    fallaron,
  };
}

/**
 * Lo que la coordinación necesita saber después de publicar: qué avisos no salieron y a quién no
 * se le llegó a escribir nunca.
 *
 * Devuelve `null` cuando salió todo: un renglón amarillo que dice "no pasó nada" entrena a no
 * leerlo. Los dos motivos se cuentan juntos porque la pregunta de quien lo lee es una sola:
 * ¿a cuánta gente tengo que avisarle por otro lado?
 */
function avisoDeAvisosQueFaltan(r: ResultadoDeAvisos, prefijo: string): string | null {
  const partes: string[] = [];
  if (r.fallaron > 0) {
    partes.push(
      r.fallaron === r.intentados
        ? "no salió ningún aviso por correo"
        : `${r.fallaron} de los ${r.intentados} avisos no salieron`,
    );
  }
  if (r.enElPadron > r.alcanzados) {
    partes.push(
      `el aviso alcanza a ${r.alcanzados} colaboradores y hay ${r.enElPadron} con correo cargado`,
    );
  }
  if (partes.length === 0) return null;
  // "Está registrado" solo cuando hubo fallas: es lo que le dice a la coordinación que puede
  // reintentarlas. Un tope de padrón no se reintenta, se resuelve de otro modo.
  const cola = r.fallaron > 0 ? " Está registrado." : "";
  return `${prefijo}, pero ${partes.join(", y ")}.${cola}`;
}

/** Mismo tercer canal que `ConvocatoriaState`: la invitación se creó, pero el correo no salió. */
export type EquipoState = { error: string | null; ok: string | null; warn?: string | null };

/**
 * Lo que hace falta para escribirle a quien acaba de quedar invitada.
 *
 * Se arma DENTRO de la transacción —es ahí donde nace la asignación y donde ya se leyó todo lo
 * demás— y se usa DESPUÉS, cuando la transacción cerró. Nunca al revés: un correo mandado
 * adentro de una transacción que después se revierte le avisa a una persona de una invitación
 * que no existe.
 */
type DatosDeInvitacion = {
  assignmentId: string;
  /** `null` cuando esa persona no tiene correo cargado en el padrón. */
  destinatario: string | null;
  greetingName: string | null;
  coverageTitle: string;
  roleName: string;
  startsAt: Date;
  city: string | null;
  respondBy: Date | null;
};

/**
 * El correo a quien quedó invitada, sea porque se la seleccionó de las postulaciones o porque
 * se la invitó directo. Es el mismo aviso: lo que sigue es su respuesta.
 *
 * Devuelve el aviso para la coordinación si no salió, o `null` si salió o si no había a dónde
 * mandarlo. Que falle no vuelve atrás nada: la persona ya está invitada y la puede ver en su
 * portal; `sendAndLogEmail` no lanza y deja registrado el intento.
 */
async function avisarInvitacion(
  workspaceId: string,
  datos: DatosDeInvitacion | null,
): Promise<string | null> {
  if (!datos) return null;
  if (!datos.destinatario) {
    // No es un fallo del envío: esa persona no tiene correo en el padrón. La coordinación
    // necesita saberlo para avisarle por otro lado, o no la va a esperar nunca.
    return "La invitación quedó hecha, pero esa persona no tiene correo cargado: avisale vos.";
  }

  const contexto = await loadWorkspaceEmailContext(workspaceId);
  const base = appUrl();

  const r = await sendAndLogEmail({
    to: datos.destinatario,
    templateKey: COVERAGE_EMAIL_KEYS.ASSIGNMENT_INVITED,
    body: buildAssignmentInvitedEmail({
      context: contexto,
      greetingName: datos.greetingName,
      coverageTitle: datos.coverageTitle,
      roleName: datos.roleName,
      fechaLabel: fechaHoraArgentina(datos.startsAt),
      city: datos.city,
      // Directo a la pantalla donde contesta: abre el correo en el teléfono y tiene que poder
      // responder en dos toques.
      assignmentUrl: base ? `${base}/portal/coberturas/asignacion/${datos.assignmentId}` : "",
      respondByLabel: datos.respondBy ? fechaArgentina(datos.respondBy) : null,
    }),
  });

  return r.status === "SENT"
    ? null
    : "La invitación quedó hecha, pero el correo no salió. Está registrado: avisale por otro lado.";
}

/**
 * **NO BORRAR: es lo que impide que dos coordinadores llenen la misma vacante.**
 *
 * Parece una consulta inútil —lee una fila y tira el resultado— y no lo es: `FOR UPDATE` toma el
 * candado de esa fila hasta que la transacción confirma. Mientras tanto, cualquier otra
 * transacción que intente tomarlo sobre el MISMO rol espera.
 *
 * Sin esto, el caso es este: un rol de una vacante, dos personas anotadas, dos coordinadores que
 * aprietan «Sumar al equipo» sobre postulantes DISTINTOS en el mismo instante. Postgres corre las
 * transacciones de Prisma en `READ COMMITTED`: las dos cuentan cero asignaciones vivas antes de
 * que ninguna escriba, las dos pasan el control de cupo y las dos escriben. El índice único
 * `(coverageId, memberId)` no frena nada, porque son dos personas diferentes. Resultado: dos
 * voluntarios invitados a un solo lugar, los dos confirman, y a la organización solicitante se le
 * avisa que el equipo está completo.
 *
 * Con el candado, la segunda transacción espera a que la primera confirme y recién ahí cuenta —
 * ya con la asignación nueva a la vista—, así que ve el rol lleno y sale por `ROL_YA_LLENO`, que
 * es justo lo que esa frase quiere decir.
 *
 * Va SIEMPRE antes del recuento y dentro de la misma transacción que escribe. Tomarlo después de
 * contar no sirve de nada, y tomarlo en una transacción distinta de la que escribe tampoco: el
 * candado se suelta al confirmar.
 *
 * No necesita migración ni índice nuevo: `CoverageRole.id` es la clave primaria.
 */
async function bloquearRol(tx: Prisma.TransactionClient, roleId: string): Promise<void> {
  // aislamiento: no lee ningún dato, sólo toma el candado; quien lo usa filtra por workspace.
  await tx.$executeRaw`SELECT id FROM "CoverageRole" WHERE id = ${roleId} FOR UPDATE`;
}

/**
 * Cuántas asignaciones vivas tiene este rol, contadas contra la base en este instante.
 *
 * **Una vacante no se puede asignar dos veces.** Dos coordinadores con la misma pantalla
 * abierta es un caso real, y lo que uno ve pintado en su navegador puede tener minutos de
 * viejo. Por eso el cupo se cuenta ADENTRO de la transacción y no se confía en lo que trajo la
 * pantalla.
 *
 * El recuento solo dice la verdad si nadie más puede estar contando lo mismo al mismo tiempo, y
 * de eso se ocupa `bloquearRol`, que las dos acciones llaman antes. Detrás quedan las otras dos
 * barreras, cada una para lo suyo: `@@unique([coverageId, memberId])` impide que la misma
 * persona entre dos veces a la misma cobertura, y `planSeleccionarPostulacion` /
 * `planInvitacionDirecta` deciden, con este número, si todavía queda lugar.
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

/**
 * Qué decirle a la coordinación cuando la transacción de armar equipo se cayó por algo que no es
 * un conflicto previsto.
 *
 * **Solo el choque del índice único significa "ya está en el equipo".** Antes los dos `catch`
 * eran ciegos: cualquier fallo —la base caída un segundo, un timeout— le decía a la coordinación
 * «Esa persona ya está en el equipo de esta cobertura», que es información falsa sobre el estado
 * del equipo y la lleva a no reintentar y a buscar a otro. Un mensaje amable que afirma algo
 * falso es peor que un error.
 *
 * P2002 es `@@unique([coverageId, memberId])`: esa persona entró al equipo desde otra pantalla
 * entre el recuento y la escritura. Es la carrera que el recuento no llega a cubrir —el candado
 * del rol serializa el cupo, no a la misma persona entrando por dos roles distintos— y se traduce
 * al aviso legible. Lo demás se registra y se pide reintentar.
 */
function errorAlArmarElEquipo(
  error: unknown,
  contexto: Record<string, string>,
): EquipoState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { error: "Esa persona ya está en el equipo de esta cobertura.", ok: null };
  }
  console.error("[fotoffice][coberturas] no se pudo armar el equipo", {
    ...contexto,
    detalle: error instanceof Error ? error.message : "error desconocido",
  });
  return { error: "No pudimos guardarlo. Probá de nuevo.", ok: null };
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
  let invitacion: DatosDeInvitacion | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const postulacion = await tx.coverageApplication.findFirst({
        where: { id: applicationId, call: { workspaceId: workspace.id } },
        select: {
          id: true,
          status: true,
          memberId: true,
          roleId: true,
          // Para el correo: a quién le escribimos y de qué actividad le hablamos.
          member: { select: { email: true, firstName: true } },
          role: {
            select: {
              id: true,
              name: true,
              vacancies: true,
              coverageId: true,
              coverage: { select: { status: true, title: true, startsAt: true, city: true } },
            },
          },
        },
      });
      if (!postulacion) throw new ConflictoDeEquipo("No encontramos esa postulación.");
      coverageIdParaRevalidar = postulacion.role.coverageId;

      // Lo más temprano posible: acá recién se sabe qué rol hay que bloquear, porque lo que llegó
      // del formulario es la postulación y no el rol. Lo que importa es que el candado esté ANTES
      // del recuento —ver `bloquearRol`—, y la lectura de arriba no decide ningún cupo.
      await bloquearRol(tx, postulacion.roleId);

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

      // aislamiento: por `postulacion`, leída acá arriba con `call: { workspaceId }` en su where.
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

      // aislamiento: `CoverageAssignment` no tiene columna de workspace; la cuelga `coverageId`,
      // que sale de la postulación ya verificada contra este workspace.
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

      invitacion = {
        assignmentId: asignacion.id,
        destinatario: postulacion.member.email,
        greetingName: postulacion.member.firstName,
        coverageTitle: postulacion.role.coverage.title,
        roleName: postulacion.role.name,
        startsAt: postulacion.role.coverage.startsAt,
        city: postulacion.role.coverage.city,
        respondBy: asignacion.respondBy,
      };

      await aplicarEfectosSobreLaBusqueda(tx, {
        workspaceId: workspace.id,
        coverageId: postulacion.role.coverageId,
        actorUserId: user.id,
        actorLabel,
      });
    });
  } catch (error) {
    if (error instanceof ConflictoDeEquipo) return { error: error.message, ok: null };
    return errorAlArmarElEquipo(error, { accion: "seleccionar la postulación", applicationId });
  }

  const warn = await avisarInvitacion(workspace.id, invitacion);

  revalidatePath(`/coberturas/c/${coverageIdParaRevalidar}`);
  return { error: null, ok: "Le mandamos la invitación. Ahora esperamos su respuesta.", warn };
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
  let invitacion: DatosDeInvitacion | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // Primera sentencia de la transacción: acá el rol llega derecho del formulario, así que el
      // candado se puede tomar antes que nada. Ver `bloquearRol` — es lo que impide que dos
      // coordinadores llenen la misma vacante al mismo tiempo. No es un chequeo de permisos: un
      // `roleId` ajeno bloquea una fila que después no aparece en la consulta de abajo.
      await bloquearRol(tx, roleId);

      // El rol tiene que ser de una cobertura de ESTE workspace, y el filtro va en la consulta
      // y no en un chequeo posterior: un `roleId` ajeno llegado a mano en el `FormData`
      // simplemente no aparece.
      const rol = await tx.coverageRole.findFirst({
        where: { id: roleId, coverage: { workspaceId: workspace.id } },
        select: {
          id: true,
          name: true,
          vacancies: true,
          coverageId: true,
          coverage: { select: { status: true, title: true, startsAt: true, city: true } },
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
        // El correo y el nombre son para el aviso; el perfil, para el control de más abajo.
        select: {
          id: true,
          email: true,
          firstName: true,
          coverageProfile: { select: { active: true } },
        },
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

      // aislamiento: `CoverageAssignment` no tiene columna de workspace; la cuelga `coverageId`,
      // que sale del rol ya verificado contra este workspace.
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

      invitacion = {
        assignmentId: asignacion.id,
        destinatario: socio?.email ?? null,
        greetingName: socio?.firstName ?? null,
        coverageTitle: rol.coverage.title,
        roleName: rol.name,
        startsAt: rol.coverage.startsAt,
        city: rol.coverage.city,
        respondBy: asignacion.respondBy,
      };

      await aplicarEfectosSobreLaBusqueda(tx, {
        workspaceId: workspace.id,
        coverageId: rol.coverageId,
        actorUserId: user.id,
        actorLabel,
      });
    });
  } catch (error) {
    if (error instanceof ConflictoDeEquipo) return { error: error.message, ok: null };
    return errorAlArmarElEquipo(error, { accion: "invitar directo", roleId, memberId });
  }

  const warn = await avisarInvitacion(workspace.id, invitacion);

  revalidatePath(`/coberturas/c/${coverageIdParaRevalidar}`);
  return { error: null, ok: "La invitamos. Ahora esperamos su respuesta.", warn };
}
