"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { COVERAGE_EMAIL_KEYS } from "@/lib/communications/constants";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { requireCoveragesCoordinator, requireCoveragesReviewer } from "@/lib/coverages/access";
import { transitionNeedsCoordinator } from "@/lib/coverages/access-policy";
import {
  buildInfoRequestedEmail,
  buildRequestApprovedEmail,
  buildRequestRejectedEmail,
  contactGreetingName,
} from "@/lib/coverages/emails";
import { recordEvent } from "@/lib/coverages/events";
import { planGenerarCobertura } from "@/lib/coverages/generar-cobertura";
import { loadRequest, loadSettings } from "@/lib/coverages/repository";
import { acotarEntero, normalizarAssignmentMode } from "@/lib/coverages/settings";
import { planStatusChange } from "@/lib/coverages/status-change-plan";
import {
  generateTrackingToken,
  hashTrackingToken,
  trackingExpiryFrom,
} from "@/lib/coverages/tracking-token";
import { debeRotarEnlace } from "@/lib/coverages/tracking-view";

/**
 * Los estados en los que una solicitud queda resuelta.
 *
 * "Resuelta" es una fecha real que después leen los informes, no un sello de cada movimiento:
 * por eso `resolvedByUserId`/`resolvedAt` sólo se escriben cuando el destino es uno de estos, y
 * no en cada cambio de estado (por ejemplo `RECIBIDA → EN_EVALUACION`, que apenas abre la
 * carpeta).
 *
 * **"Resuelta" no es lo mismo que "terminal" ni que "no viva".** Son dos preguntas distintas:
 * - Resuelta = ¿alguien ya decidió? Aprobar ES decidir, así que `APROBADA` entra acá.
 * - Viva (`REQUEST_LIVE_STATUSES`, en `./states.ts`) = ¿todavía se puede cancelar?
 *
 * `APROBADA` es las dos cosas a la vez, y no es una contradicción: la solicitud ya fue
 * decidida, pero la cobertura todavía no ocurrió, así que la organización o el solicitante
 * todavía la pueden cancelar. Por eso esta lista **no se deriva de** `REQUEST_LIVE_STATUSES`
 * (ni al revés): una es "¿ya se decidió?" y la otra es "¿se puede cancelar?", y comparten un
 * estado sin ser la misma pregunta.
 *
 * Aviso para quien lea esto en seis meses: si "arreglás" la aparente contradicción unificando
 * las dos listas (por ejemplo, sacando `APROBADA` de una de las dos porque "ya está en la
 * otra"), vas a romper o el filtro de la bandeja (`urgentes` necesita ver las aprobadas
 * pendientes de cobertura) o la fecha de resolución (`resolvedAt` dejaría de marcarse cuando
 * se aprueba). Las dos listas están bien como están, separadas.
 */
const ESTADOS_RESUELTOS = new Set([
  "APROBADA",
  "RECHAZADA",
  "CERRADA",
  "CANCELADA_SOLICITANTE",
  "CANCELADA_ORGANIZACION",
]);

export type PanelState = { error: string | null; ok: string | null; warn?: string | null };

/**
 * `warn` es para lo que salió a medias: el cambio se hizo pero el aviso no salió.
 *
 * Sin ese tercer canal habría que elegir entre pintar de verde un fallo o de rojo una
 * aprobación que sí ocurrió, y las dos cosas hacen que la coordinación actúe mal. Es el mismo
 * criterio que ya usa el alta de socios.
 */
export async function changeRequestStatusAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const to = formData.get("to")?.toString() ?? "";

  /**
   * El guard depende de a dónde va la solicitud, no de qué botón se apretó.
   *
   * Empezar a evaluar es trabajo de secretaría: alcanza con `requireCoveragesReviewer`.
   * Aprobar, rechazar, cerrar o cancelar comprometen el tiempo de voluntarios y la palabra de
   * la institución frente a quien pidió la cobertura, así que exigen coordinar. Ver
   * `transitionNeedsCoordinator` en `lib/coverages/access-policy.ts`.
   */
  const { user, workspace } = transitionNeedsCoordinator(to)
    ? await requireCoveragesCoordinator()
    : await requireCoveragesReviewer();
  const id = formData.get("id")?.toString() ?? "";
  const reason = formData.get("reason")?.toString()?.trim() || null;

  const solicitud = await prisma.coverageRequest.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { client: { select: { email: true, businessName: true, firstName: true, lastName: true } } },
  });

  const plan = planStatusChange({ solicitud, workspaceId: workspace.id, to, reason });
  if (!plan.ok) return { error: plan.error, ok: null };
  if (!solicitud) return { error: "No encontramos esa solicitud.", ok: null };

  /**
   * Al aprobar, el plazo del enlace nuevo sale de la configuración del workspace. Se lee antes
   * de la transacción porque es sólo eso, un número de configuración: no forma parte del hecho
   * que hay que hacer atómico (el cambio de estado y el guardado del token nuevo), y si
   * cambiara entre esta lectura y el guardado no hay ninguna inconsistencia que temer.
   */
  const settings = plan.to === "APROBADA" ? await loadSettings(workspace.id) : null;

  /**
   * Rotar el enlace de seguimiento al aprobar.
   *
   * El plan original de esta tarea dejaba el `trackingUrl` del correo como un marcador
   * (`/sc/…`): el token crudo del enlace de recepción nunca se guardó —en la base sólo vive su
   * SHA-256 (`tokenHash`)— así que no hay forma de reconstruir ESE enlace acá. La única opción
   * es emitir uno nuevo. De paso, rotar deja un solo enlace vivo por solicitud en vez de que
   * convivan el viejo y el nuevo, que es preferible.
   *
   * Pero rotar es irreversible, y sólo conviene si el correo con el enlace nuevo va a poder
   * salir: si no hay a quién mandárselo o no hay con qué armar el enlace, rotar deja a la
   * organización sin ningún enlace vivo, y en esta etapa no hay "reenviar enlace" para
   * repararlo. Por eso se decide con `debeRotarEnlace` ANTES de abrir la transacción: así el
   * `if` de adentro no repite esta lógica y no puede desalinearse de ella.
   *
   * Consecuencia asumida cuando sí se rota: un enlace viejo que la organización tenga guardado
   * (por ejemplo, el del correo de recepción) deja de servir en cuanto se emite éste.
   *
   * El rechazo NO pasa por acá: no rota ni manda enlace, porque el circuito terminó (ver el
   * comentario de `buildRequestRejectedEmail`).
   */
  const destino = solicitud.client.email;
  const base = appUrl();
  const rotar =
    plan.to === "APROBADA" &&
    settings !== null &&
    debeRotarEnlace({ tieneDestinatario: Boolean(destino), tieneAppUrl: Boolean(base) });

  let rawToken: string | null = null;

  await prisma.$transaction(async (tx) => {
    let tokenFields: { tokenHash: string; tokenExpiresAt: Date } | Record<string, never> = {};
    if (rotar && settings) {
      rawToken = generateTrackingToken();
      tokenFields = {
        tokenHash: hashTrackingToken(rawToken),
        tokenExpiresAt: trackingExpiryFrom(settings.trackingLinkTtlDays),
      };
    }

    // aislamiento: por `solicitud`, leída arriba con `workspaceId` en su where.
    await tx.coverageRequest.update({
      where: { id: solicitud.id },
      data: {
        status: plan.to,
        rejectionReason: plan.to === "RECHAZADA" ? reason : solicitud.rejectionReason,
        // "Resuelta" es una fecha real que después leen los informes, no un sello de cada
        // movimiento: sólo se escribe cuando el destino es terminal (ver ESTADOS_RESUELTOS).
        // `RECIBIDA → EN_EVALUACION`, por ejemplo, no resuelve nada, apenas abre la carpeta.
        ...(ESTADOS_RESUELTOS.has(plan.to)
          ? { resolvedByUserId: user.id, resolvedAt: new Date() }
          : {}),
        ...tokenFields,
      },
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "REQUEST",
      entityId: solicitud.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: plan.from,
      toStatus: plan.to,
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
      note: reason,
    });
  });

  let warn: string | null = null;
  if (destino && (plan.to === "APROBADA" || plan.to === "RECHAZADA")) {
    const contexto = await loadWorkspaceEmailContext(workspace.id);
    const comun = {
      context: contexto,
      publicCode: solicitud.publicCode,
      eventTitle: solicitud.eventTitle,
      contactName: contactGreetingName(solicitud.client),
      trackingUrl: rawToken && base ? `${base}/sc/${rawToken}` : "",
    };
    const resultado = await sendAndLogEmail({
      to: destino,
      templateKey:
        plan.to === "APROBADA" ? COVERAGE_EMAIL_KEYS.APPROVED : COVERAGE_EMAIL_KEYS.REJECTED,
      body:
        plan.to === "APROBADA"
          ? buildRequestApprovedEmail(comun)
          : buildRequestRejectedEmail({ ...comun, reason: reason ?? "" }),
    });
    if (resultado.status !== "SENT") {
      warn = rotar
        ? "El cambio quedó guardado, pero el correo no salió. El enlace anterior dejó de funcionar: hay que reenviarle uno nuevo."
        : "El cambio quedó guardado, pero el correo no salió. Está registrado.";
    }
  }

  revalidatePath("/coberturas");
  revalidatePath(`/coberturas/${solicitud.id}`);
  return { error: null, ok: "Listo.", warn };
}

/** Pedirle un dato a la organización. Lo ve en su enlace y puede responder desde ahí. */
export async function requestInfoAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { user, workspace } = await requireCoveragesReviewer();
  const id = formData.get("id")?.toString() ?? "";
  const texto = formData.get("infoRequested")?.toString()?.trim();
  if (!texto) return { error: "Escribí qué hace falta.", ok: null };

  const solicitud = await prisma.coverageRequest.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { client: { select: { email: true, businessName: true, firstName: true, lastName: true } } },
  });
  if (!solicitud) return { error: "No encontramos esa solicitud.", ok: null };

  const plan = planStatusChange({
    solicitud,
    workspaceId: workspace.id,
    to: "REQUIERE_INFO",
    reason: texto,
  });
  if (!plan.ok) return { error: plan.error, ok: null };

  // Ídem `changeRequestStatusAction`: el plazo sale de la configuración, y esta lectura no
  // necesita ser parte de la transacción que rota el token y cambia el estado.
  const settings = await loadSettings(workspace.id);

  /**
   * Este correo sí lleva un enlace —la organización puede responder desde ahí— y el token
   * crudo del enlace anterior no se puede recuperar (sólo vive su hash). Se rota acá mismo, ver
   * el comentario de `changeRequestStatusAction`: sólo conviene si el correo con el enlace
   * nuevo va a poder salir, y eso se decide con `debeRotarEnlace` ANTES de abrir la
   * transacción, no adentro.
   */
  const destino = solicitud.client.email;
  const base = appUrl();
  const rotar = debeRotarEnlace({ tieneDestinatario: Boolean(destino), tieneAppUrl: Boolean(base) });

  let rawToken = "";

  await prisma.$transaction(async (tx) => {
    let tokenFields: { tokenHash: string; tokenExpiresAt: Date } | Record<string, never> = {};
    if (rotar) {
      rawToken = generateTrackingToken();
      tokenFields = {
        tokenHash: hashTrackingToken(rawToken),
        tokenExpiresAt: trackingExpiryFrom(settings.trackingLinkTtlDays),
      };
    }
    // aislamiento: por `solicitud`, leída arriba con `workspaceId` en su where.
    await tx.coverageRequest.update({
      where: { id: solicitud.id },
      data: {
        status: "REQUIERE_INFO",
        infoRequested: texto,
        ...tokenFields,
      },
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "REQUEST",
      entityId: solicitud.id,
      type: "INFO_PEDIDA",
      fromStatus: plan.from,
      toStatus: "REQUIERE_INFO",
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
      note: texto,
    });
  });

  let warn: string | null = null;
  if (destino) {
    const contexto = await loadWorkspaceEmailContext(workspace.id);
    const r = await sendAndLogEmail({
      to: destino,
      templateKey: COVERAGE_EMAIL_KEYS.INFO_REQUESTED,
      body: buildInfoRequestedEmail({
        context: contexto,
        publicCode: solicitud.publicCode,
        eventTitle: solicitud.eventTitle,
        contactName: contactGreetingName(solicitud.client),
        trackingUrl: rawToken && base ? `${base}/sc/${rawToken}` : "",
        infoRequested: texto,
      }),
    });
    if (r.status !== "SENT") {
      warn = rotar
        ? "El cambio quedó guardado, pero el correo no salió. El enlace anterior dejó de funcionar: hay que reenviarle uno nuevo."
        : "Quedó pedido, pero el correo no salió. Está registrado.";
    }
  }

  revalidatePath(`/coberturas/${solicitud.id}`);
  return { error: null, ok: "Se lo pedimos.", warn };
}

/** Una nota interna. La organización nunca la ve. */
export async function addNoteAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { user, workspace } = await requireCoveragesReviewer();
  const id = formData.get("id")?.toString() ?? "";
  const nota = formData.get("note")?.toString()?.trim();
  if (!nota) return { error: "Escribí la nota.", ok: null };

  const existe = await prisma.coverageRequest.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existe) return { error: "No encontramos esa solicitud.", ok: null };

  await recordEvent(prisma, {
    workspaceId: workspace.id,
    entityType: "REQUEST",
    entityId: existe.id,
    type: "NOTA",
    actorUserId: user.id,
    actorLabel: user.name ?? user.email,
    note: nota,
  });

  revalidatePath(`/coberturas/${existe.id}`);
  return { error: null, ok: "Anotado." };
}

/**
 * Guardar la configuración del módulo.
 *
 * `upsert` y no `update`: un workspace que nunca la tocó no tiene fila, y obligar a crearla
 * antes de poder editarla sería un paso que no le importa a nadie.
 *
 * Los números se acotan a rangos sensatos. Un umbral de refuerzo en cero haría que el aviso
 * salte en toda cobertura y la gente deje de leerlo, que es peor que no tenerlo.
 */
export async function saveCoverageSettingsAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { workspace } = await requireCoveragesCoordinator();

  const entero = (nombre: string, min: number, max: number, porOmision: number): number =>
    acotarEntero(formData.get(nombre)?.toString(), min, max, porOmision);

  const texto = (nombre: string): string | null =>
    formData.get(nombre)?.toString()?.trim() || null;

  const lista = (nombre: string): string[] =>
    (formData.get(nombre)?.toString() ?? "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const datos = {
    moduleLabel: texto("moduleLabel"),
    termRequest: texto("termRequest"),
    termCollaborator: texto("termCollaborator"),
    termRequester: texto("termRequester"),
    termCall: texto("termCall"),
    assignmentMode: normalizarAssignmentMode(formData.get("assignmentMode")?.toString()),
    requiresApproval: formData.get("requiresApproval") === "on",
    requiresCoordinatorConfirmation:
      formData.get("requiresCoordinatorConfirmation") === "on",
    reinforcementThresholdMinutes: entero("reinforcementThresholdMinutes", 30, 24 * 60, 180),
    recommendedCollaborators: entero("recommendedCollaborators", 1, 20, 2),
    publicFormEnabled: formData.get("publicFormEnabled") === "on",
    publicFormIntro: texto("publicFormIntro"),
    notifyEmails: lista("notifyEmails"),
    zones: lista("zones"),
    specialties: lista("specialties"),
    roleTemplates: lista("roleTemplates"),
  };

  await prisma.coverageSettings.upsert({
    where: { workspaceId: workspace.id },
    update: datos,
    create: { workspaceId: workspace.id, ...datos },
  });

  revalidatePath("/coberturas/configuracion");
  revalidatePath("/coberturas");
  return { error: null, ok: "Guardado." };
}

export type GenerarCoberturaState = { error: string | null; ok: string | null };

/**
 * De una solicitud aprobada, generar una cobertura con sus roles.
 *
 * `requireCoveragesCoordinator()` de nuevo acá: el botón para generar una cobertura ya está
 * escondido en la pantalla para quien solo revisa (ver el cuidado del plan sobre esconder
 * botones), pero eso no reemplaza el control del servidor.
 *
 * Los roles llegan como dos listas paralelas (`roleName[]`, `roleVacancies[]`) en vez de un
 * único campo por fila: el formulario permite agregar y quitar filas del lado del cliente, y
 * `FormData.getAll` devuelve cada clave en el orden en que aparece en el documento, así que
 * emparejar por índice alcanza sin inventar una convención de nombres por fila.
 */
export async function crearCoberturaAction(
  _prev: GenerarCoberturaState | undefined,
  formData: FormData,
): Promise<GenerarCoberturaState> {
  const { user, workspace } = await requireCoveragesCoordinator();

  const requestId = formData.get("requestId")?.toString() ?? "";
  const title = formData.get("title")?.toString()?.trim();
  if (!title) return { error: "Ponele un título a la cobertura.", ok: null };

  const startsAt = new Date(formData.get("startsAt")?.toString() ?? "");
  const endsAt = new Date(formData.get("endsAt")?.toString() ?? "");
  if (Number.isNaN(startsAt.getTime())) return { error: "Falta cuándo empieza.", ok: null };
  if (Number.isNaN(endsAt.getTime())) return { error: "Falta cuándo termina.", ok: null };
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { error: "Termina antes de empezar. Revisá los horarios.", ok: null };
  }

  const addressLine = formData.get("addressLine")?.toString()?.trim() || null;
  const city = formData.get("city")?.toString()?.trim() || null;
  const instructions = formData.get("instructions")?.toString()?.trim() || null;

  const roleNames = formData.getAll("roleName").map((v) => v.toString());
  const roleVacancies = formData.getAll("roleVacancies").map((v) => v.toString());
  const roles = roleNames
    .map((name, i) => ({ name: name.trim(), vacancies: Math.trunc(Number(roleVacancies[i])) }))
    .filter((r) => r.name.length > 0);

  const solicitud = await loadRequest({ workspaceId: workspace.id, id: requestId });

  const plan = planGenerarCobertura({ solicitud, workspaceId: workspace.id, roles });
  if (!plan.ok) return { error: plan.error, ok: null };
  if (!solicitud) return { error: "No encontramos esa solicitud.", ok: null };

  const cobertura = await prisma.$transaction(async (tx) => {
    const creada = await tx.coverage.create({
      data: {
        workspaceId: workspace.id,
        requestId: solicitud.id,
        title,
        startsAt,
        endsAt,
        addressLine,
        city,
        instructions,
        status: "PLANIFICADA",
        roles: { create: roles.map((r) => ({ name: r.name, vacancies: r.vacancies })) },
      },
      select: { id: true },
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "COVERAGE",
      entityId: creada.id,
      type: "CREADA",
      toStatus: "PLANIFICADA",
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
    });
    return creada;
  });

  revalidatePath(`/coberturas/${solicitud.id}`);
  redirect(`/coberturas/c/${cobertura.id}`);
}
