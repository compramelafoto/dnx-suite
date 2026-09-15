import "server-only";
import type { Prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import type { EstadoDeRol } from "./cupos";
import { contactGreetingName } from "./emails";
import { fechaHoraArgentina } from "./format";
import { loadCoverageParaAvisoDeEquipo, loadSettings } from "./repository";
import {
  generateTrackingToken,
  hashTrackingToken,
  trackingExpiryFrom,
} from "./tracking-token";
import { debeRotarEnlace } from "./tracking-view";
import { efectosSobreLaBusqueda, postulacionesQueSeCierran, type EfectosSobreLaBusqueda } from "./equipo";
import { recordEvent } from "./events";
import { APPLICATION_LIVE_STATUSES, ASSIGNMENT_LIVE_STATUSES } from "./states";

/**
 * Lo que le pasa a la convocatoria y a la cobertura cada vez que se toca el equipo.
 *
 * Vive acá y no repetido en cada acción porque es exactamente el mismo recálculo lo mire quien
 * lo mire: seleccionar una postulación, invitar directo, confirmar o avisar que no se puede.
 * Que una de las cuatro se olvidara de recalcular es cómo una cobertura queda diciendo que
 * tiene equipo cuando ya no lo tiene.
 *
 * **Se llama SIEMPRE dentro de la transacción que escribió el cambio**, con el mismo `tx`: la
 * decisión de estado y la escritura que la provoca tienen que confirmarse juntas o no
 * confirmarse. Por eso vuelve a leer los roles desde la base en vez de recibirlos — adentro de
 * la transacción, esa lectura ya ve la asignación recién escrita.
 *
 * Devuelve lo que efectivamente cambió, para que quien llama sepa si ESTA acción fue la que
 * completó el equipo: de eso depende el correo a la organización solicitante, que sale después
 * de que la transacción cerró y una sola vez.
 */
export async function aplicarEfectosSobreLaBusqueda(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    coverageId: string;
    actorUserId: number | null;
    actorLabel: string | null;
    /**
     * Lo preparado ANTES de abrir la transacción para poder avisarle a la organización
     * solicitante (ver `prepararAvisoDeEquipoCompleto`). Si el equipo queda confirmado acá, el
     * enlace de seguimiento se rota en ESTA transacción; el correo sale después, afuera.
     */
    avisoDeEquipoCompleto?: AvisoDeEquipoCompleto | null;
  },
): Promise<EfectosSobreLaBusqueda> {
  const cobertura = await tx.coverage.findFirst({
    where: { id: input.coverageId, workspaceId: input.workspaceId },
    select: {
      id: true,
      status: true,
      roles: { select: { vacancies: true, assignments: { select: { status: true } } } },
      call: { select: { id: true, status: true } },
    },
  });
  if (!cobertura) return { callStatus: null, coverageStatus: null };

  const roles: EstadoDeRol[] = cobertura.roles.map((r) => ({
    vacancies: r.vacancies,
    asignadasVivas: r.assignments.filter((a) =>
      (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
    ).length,
    asignadasAceptadas: r.assignments.filter(
      (a) => a.status === "ACEPTADA" || a.status === "CONFIRMADA",
    ).length,
  }));

  const efectos = efectosSobreLaBusqueda({
    roles,
    callStatus: cobertura.call?.status ?? null,
    coverageStatus: cobertura.status,
  });

  if (efectos.callStatus !== null && cobertura.call) {
    await tx.coverageCall.update({
      where: { id: cobertura.call.id },
      data: { status: efectos.callStatus },
    });
    await recordEvent(tx, {
      workspaceId: input.workspaceId,
      entityType: "CALL",
      entityId: cobertura.call.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: cobertura.call.status,
      toStatus: efectos.callStatus,
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
    });
  }

  if (efectos.coverageStatus !== null) {
    await tx.coverage.update({
      where: { id: cobertura.id },
      data: { status: efectos.coverageStatus },
    });
    await recordEvent(tx, {
      workspaceId: input.workspaceId,
      entityType: "COVERAGE",
      entityId: cobertura.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: cobertura.status,
      toStatus: efectos.coverageStatus,
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
    });
  }

  if (efectos.coverageStatus === "EQUIPO_CONFIRMADO" && input.avisoDeEquipoCompleto?.rotacion) {
    const { requestId, rotacion } = input.avisoDeEquipoCompleto;
    // `updateMany` con el workspace en el `where`, no un `update` por id: la solicitud se leyó
    // afuera de esta transacción y el aislamiento vuelve a viajar con la escritura.
    await tx.coverageRequest.updateMany({
      where: { id: requestId, workspaceId: input.workspaceId },
      data: { tokenHash: rotacion.tokenHash, tokenExpiresAt: rotacion.tokenExpiresAt },
    });
  }

  await cerrarPostulacionesSinRespuesta(tx, {
    workspaceId: input.workspaceId,
    coverageId: cobertura.id,
    equipoQuedoConfirmado: efectos.coverageStatus === "EQUIPO_CONFIRMADO",
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel,
  });

  return efectos;
}

/**
 * Las postulaciones que nadie contestó, cerradas cuando el equipo ya quedó armado.
 *
 * En la MISMA transacción que confirma el equipo: si el equipo queda confirmado y estas
 * postulaciones siguieran abiertas, el portal le diría "te anotaste" a alguien cuya espera ya
 * terminó. Son la misma verdad contada en dos tablas, así que se escriben juntas o no se
 * escribe ninguna.
 *
 * **Sin correo**: nadie recibe un "no fuiste elegida" (ver `postulacionesQueSeCierran`).
 *
 * `actorUserId` es quien haya provocado el cambio —casi siempre la persona que confirmó su
 * asignación desde el portal, no la coordinación—, y por eso el evento va sin nota: el
 * historial registra que el sistema las cerró al completarse el equipo, no que alguien las
 * rechazó una por una.
 */
async function cerrarPostulacionesSinRespuesta(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    coverageId: string;
    equipoQuedoConfirmado: boolean;
    actorUserId: number | null;
    actorLabel: string | null;
  },
): Promise<void> {
  if (!input.equipoQuedoConfirmado) return;

  // El filtro va por la convocatoria, que es quien lleva el `workspaceId` en `CoverageApplication`
  // (el modelo no tiene la columna directa), y además por la cobertura: una convocatoria es 1:1
  // con su cobertura, así que esto son exactamente las postulaciones de ESTA cobertura.
  const abiertas = await tx.coverageApplication.findMany({
    where: {
      status: { in: [...APPLICATION_LIVE_STATUSES] },
      call: { coverageId: input.coverageId, workspaceId: input.workspaceId },
    },
    select: { id: true, status: true },
  });

  const aCerrar = postulacionesQueSeCierran({
    equipoQuedoConfirmado: input.equipoQuedoConfirmado,
    postulaciones: abiertas,
  });
  if (aCerrar.length === 0) return;

  await tx.coverageApplication.updateMany({
    where: { id: { in: aCerrar } },
    data: { status: "NO_SELECCIONADA" },
  });

  for (const postulacion of abiertas) {
    if (!aCerrar.includes(postulacion.id)) continue;
    await recordEvent(tx, {
      workspaceId: input.workspaceId,
      entityType: "APPLICATION",
      entityId: postulacion.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: postulacion.status,
      toStatus: "NO_SELECCIONADA",
      actorUserId: input.actorUserId,
      actorLabel: input.actorLabel,
    });
  }
}


/**
 * Todo lo que hace falta para avisarle a la organización solicitante que su equipo está armado,
 * resuelto ANTES de abrir la transacción.
 *
 * Por qué antes: ese correo lleva un enlace de seguimiento nuevo, y emitirlo mata el que la
 * organización ya tenía. Rotar es irreversible, y solo conviene si el correo con el enlace nuevo
 * va a poder salir — si no hay a quién mandárselo, o no hay `appUrl()` con qué armarlo, rotar
 * deja a la organización sin ningún enlace vivo y en esta etapa no hay "reenviar enlace" para
 * repararlo. Por eso la decisión se toma acá, con `debeRotarEnlace`, y la transacción se limita
 * a ejecutarla. Es el mismo criterio de los correos de la etapa 1a (ver
 * `changeRequestStatusAction`).
 *
 * Devuelve `null` cuando no hay a quién avisarle: sin solicitud detrás de la cobertura, o sin
 * correo en la ficha del padrón. En ese caso no se rota nada y no sale ningún correo.
 *
 * Prepararlo cuesta dos lecturas que casi siempre no se usan —el equipo se completa una sola vez
 * en la vida de una cobertura—, y se paga igual: saber si ESTA confirmación completó el equipo
 * recién se sabe adentro de la transacción, y ahí ya es tarde para decidir si rotar.
 */
export type AvisoDeEquipoCompleto = {
  requestId: string;
  publicCode: string;
  eventTitle: string;
  contactName: string;
  /** Dirección de la organización solicitante. Nunca vacía: sin ella esto devuelve `null`. */
  destinatario: string;
  fechaLabel: string;
  city: string | null;
  /** El enlace nuevo, ya decidido. `null` cuando no corresponde rotar. */
  rotacion: { rawToken: string; tokenHash: string; tokenExpiresAt: Date } | null;
  /** El enlace listo para el correo, o `""` si no se rotó: `compose` no pinta un botón muerto. */
  trackingUrl: string;
};

export async function prepararAvisoDeEquipoCompleto(input: {
  workspaceId: string;
  coverageId: string;
}): Promise<AvisoDeEquipoCompleto | null> {
  const cobertura = await loadCoverageParaAvisoDeEquipo(input);
  const solicitud = cobertura?.request;
  const destinatario = solicitud?.client.email?.trim();
  if (!cobertura || !solicitud || !destinatario) return null;

  const base = appUrl();
  const rotar = debeRotarEnlace({ tieneDestinatario: true, tieneAppUrl: Boolean(base) });

  let rotacion: AvisoDeEquipoCompleto["rotacion"] = null;
  if (rotar) {
    const settings = await loadSettings(input.workspaceId);
    const rawToken = generateTrackingToken();
    rotacion = {
      rawToken,
      tokenHash: hashTrackingToken(rawToken),
      tokenExpiresAt: trackingExpiryFrom(settings.trackingLinkTtlDays),
    };
  }

  return {
    requestId: solicitud.id,
    publicCode: solicitud.publicCode,
    eventTitle: solicitud.eventTitle,
    contactName: contactGreetingName(solicitud.client),
    destinatario,
    fechaLabel: fechaHoraArgentina(cobertura.startsAt),
    city: cobertura.city,
    rotacion,
    trackingUrl: rotacion ? `${base}/sc/${rotacion.rawToken}` : "",
  };
}
