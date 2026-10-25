import { campos, clave, entero, fecha, idAlboom, importe, siNo, texto, textoLargo } from "../normalizar";
import type { Campos, Crudo, Decision, EntradaMapa } from "../tipos";
import { ACTOR_ALBOOM, DUDAS_8B2, MOTIVOS_8B2, htmlATexto, instanteAr, notaDeAlboom, padreDe, renglon, traeHora, usuario, yaCargado } from "./historia";

/**
 * Oportunidades de Alboom (`/leads/paginate`, doc 01 §13.1) → Consultas de FOTOFFICE, con su historia en la línea de
 * tiempo. Puro.
 *
 * - Oportunidad → `ServiceSalesLead` + `FotofficeConsulta` + número (el id de Alboom, sin consumir la secuencia) +
 *   recorrido VENTA en su circuito y etapa (la etapa de Alboom es una POSICIÓN: se traduce con las filas
 *   `posicion_embudo` que dejó la 8B-1) + nota "Datos de Alboom" en la ficha del contacto con lo que no tiene
 *   columna (título, prioridad, delegado, clase, etiquetas, siguiente acción, campos extra, estado original).
 * - Historial de etapas → pasos del recorrido. Notas → notas de la ficha del contacto. Actividades → hechos de la
 *   línea de tiempo (`ALBOOM_ACTIVIDAD`). Correos y WhatsApp → mensajes de la ficha (ya enviados: no se mandan).
 * Nada de esto avisa: el escritor no llama al alta de consultas (sin aviso al equipo, sin respuesta automática).
 */

export const TIPO_CONSULTA = "CONSULTA";
export const TIPO_PASO = "JOURNEY_STEP";
export const TIPO_NOTA = "NOTE";
export const TIPO_ACTIVIDAD = "PERSON_EVENT";
export const TIPO_MENSAJE = "MESSAGE";

export const KIND_ACTIVIDAD = "ALBOOM_ACTIVIDAD";

const TXT = 200;

/** Estados de oportunidad (doc 01 §6.1). */
export const ESTADO_OPORTUNIDAD: Record<string, string> = {
  "421": "Abierto",
  "422": "Ganado",
  "423": "Suspendido",
  "424": "Abandonado",
  "425": "Perdido",
  "426": "Fecha no disponible",
};

export type CtxConsultas = {
  contactoDe: Map<string, string>;
  /** Id de Alboom de la categoría (`lead_type/<id>` en el mapa de `categorias`) → categoría de consulta. */
  categoriaDe: Map<string, string>;
  /** Nombre normalizado del origen → origen de FOTOFFICE. */
  origenPorNombre: Map<string, string>;
  /** Id de Alboom del embudo → circuito. */
  circuitoDe: Map<string, string>;
  /** "<embudo>/<posición>" → etapa. */
  etapaDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  /** Día de la carga ("aaaa-mm-dd", Argentina): una abierta con el evento antes de hoy se cierra como perdida. */
  hoy: string;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

/** Motivo de pérdida de las abiertas en Alboom con el evento ya pasado (regla de Daniel, 25/10/2026). */
export const MOTIVO_EVENTO_PASADO = "Evento pasado sin respuesta (migración de Alboom)";
export const DUDA_EVENTO_PASADO = "Abierta en Alboom con el evento ya pasado: se cargó como perdida";
/** Motivo de pérdida de las cerradas en Alboom: el estado ES el motivo (doc 01 §6.1). */
export const motivoDeEstado = (estado: string) => `${ESTADO_OPORTUNIDAD[estado] ?? "Perdido"} (Alboom)`;

const id = (v: unknown) => idAlboom(v);

export function traducirConsulta(c: Crudo, ctx: CtxConsultas): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const idCliente = id(p.customer_id);
  const clientId = idCliente ? ctx.contactoDe.get(idCliente) : undefined;
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const idCategoria = id(p.category_id);
  const categoryId = idCategoria ? ctx.categoriaDe.get(`lead_type/${idCategoria}`) : undefined;
  if (!categoryId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.categoriaSinCargar };
  const dudas: string[] = [];

  const estado = id(p.status_id) ?? "421";
  const evento = fecha(p.event_date);
  // Abierta con el evento ya pasado: se carga perdida, con su motivo (y la cuenta el informe como duda).
  const vencida = estado === "421" && evento !== null && evento < ctx.hoy;
  if (vencida) dudas.push(DUDA_EVENTO_PASADO);
  const abierta = estado === "421" && !vencida;
  const outcome = abierta ? null : estado === "422" ? "GANADA" : "PERDIDA";
  const leadStatus = abierta ? "NEW" : estado === "422" ? "WON" : "LOST";
  const motivoPerdida = outcome !== "PERDIDA" ? null : vencida ? MOTIVO_EVENTO_PASADO : motivoDeEstado(estado);

  // Recorrido VENTA: circuito por el embudo, etapa por la posición.
  const idEmbudo = id(p.pipeline_id);
  const circuitId = idEmbudo ? (ctx.circuitoDe.get(idEmbudo) ?? null) : null;
  const posicion = entero(p.stage_id);
  let stageId: string | null = null;
  let primeraEtapa = false;
  if (circuitId) {
    stageId = posicion !== null ? (ctx.etapaDe.get(`${idEmbudo}/${posicion}`) ?? null) : null;
    if (abierta && !stageId) {
      primeraEtapa = true;
      dudas.push(DUDAS_8B2.sinEtapa);
    }
  } else if (idEmbudo) dudas.push(DUDAS_8B2.sinCircuito);

  const idReferente = id(p.referrer_id);
  const referrer = idReferente ? (ctx.contactoDe.get(idReferente) ?? null) : null;
  const origen = texto(p.lead_origin, 200);
  const lugar = texto(p.place_event, TXT);
  const ciudad = texto(p.city_event, TXT);
  const invitados = entero(p.guests);
  const creada = instanteAr(p.created) ?? instanteAr(p.modified);
  const cierre = instanteAr(p.completed_date) ?? instanteAr(p.modified) ?? creada;
  const valor = importe(p.amount);

  const nota = notaDeAlboom(`Datos de Alboom de la consulta ${c.alboomId}`, [
    ...renglon("Título", p.name, 300),
    ...renglon("Estado en Alboom", ESTADO_OPORTUNIDAD[estado] ?? estado),
    ...(vencida ? [`Se cargó como perdida: ${MOTIVO_EVENTO_PASADO}`] : []),
    ...renglon("Etapa en Alboom", p.stage_name),
    ...renglon("Prioridad", p.priority_name),
    ...renglon("Delegado", [texto(p.delegated_name), texto(p.delegated_lastname)].filter(Boolean).join(" ")),
    ...renglon("Clase", p.class),
    ...renglon("Etiquetas", p.tags),
    ...renglon("Siguiente acción", fecha(p.due_date)),
    ...renglon("Fecha de inicio", fecha(p.started_date)),
    ...renglon("Provincia del evento", p.state_event),
    ...renglon("País del evento", p.country_event),
    ...renglon("Invitados", invitados === null ? p.guests : null),
    ...renglon("Seguimiento automático", siNo(p.enable_followup) ? "sí" : null),
    ...["extra1", "extra2", "extra3", "extra4", "extra_date1", "extra_date2"].flatMap((k) => renglon(`Campo ${k}`, p[k])),
  ]);

  const datos: Campos = {
    clientId,
    categoryId,
    originId: origen ? (ctx.origenPorNombre.get(clave(origen)) ?? null) : null,
    referrerClientId: referrer && referrer !== clientId ? referrer : null,
    estimatedValue: valor !== null && Number(valor) > 0 ? valor : null,
    eventDate: evento,
    eventStartsAt: evento ? instanteAr(p.event_date) : null,
    eventTimeKnown: evento ? traeHora(p.event_date) : false,
    venue: lugar,
    receptionVenue: texto(p.place_reception, TXT),
    city: ciudad,
    eventLocation: lugar ?? ciudad,
    guests: invitados !== null && invitados >= 0 && invitados <= 100_000 ? invitados : null,
    partnerOneName: texto(p.bride_name, TXT),
    partnerTwoName: texto(p.groom_name, TXT),
    message: textoLargo(p.description, 4000),
    leadStatus,
    createdAt: creada,
    numero: c.alboomId,
    circuitId,
    stageId,
    primeraEtapa,
    outcome,
    motivoPerdida,
    closedAt: abierta ? null : vencida ? instanteAr(`${ctx.hoy} 12:00:00`) : cierre,
    enteredStageAt: creada,
    stageDueAt: abierta ? instanteAr(p.due_date) : null,
    ownerUserId: usuario(ctx.usuarioDe, p.user_id),
    nota,
  };
  return { accion: "CREAR", datos, extra: { metaJson: { origen: "alboom", alboomId: c.alboomId, ...(texto(p.name, 300) ? { titulo: texto(p.name, 300) } : {}) } }, huellas: {}, ...(dudas.length ? { dudas } : {}) };
}

// ── Hijos de la oportunidad ────────────────────────────────────────────────────

export type CtxHijosConsulta = {
  /** Id de Alboom de la oportunidad → `ServiceSalesLead` cargado (o simulado). */
  leadDe: Map<string, string>;
  /** Id de Alboom de la oportunidad → su contacto de FOTOFFICE. */
  clienteDeLead: Map<string, string>;
  /** Id de Alboom de la oportunidad → su embudo de Alboom (sólo las que quedaron con recorrido). */
  embudoDeLead: Map<string, string>;
  etapaDe: Map<string, string>;
  contactoDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  /** Nombre normalizado de la categoría de nota → categoría de FOTOFFICE. */
  categoriasNota: Map<string, string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

function deLaConsulta(c: Crudo, ctx: CtxHijosConsulta): { lead: string; idLead: string } | Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const idLead = padreDe(c.alboomId) ?? id(campos(c.payload).target_id);
  const lead = idLead ? ctx.leadDe.get(idLead) : undefined;
  if (!idLead || !lead) return { accion: "OMITIR", motivo: MOTIVOS_8B2.consultaSinCargar };
  return { lead, idLead };
}

const esDecision = (x: unknown): x is Decision => typeof x === "object" && x !== null && "accion" in x;

function autor(p: Record<string, unknown>, usuarioDe: Map<string, string>) {
  const nombre = [texto(p.user_name, 80), texto(p.user_lastname, 80)].filter(Boolean).join(" ");
  return { actorUserId: usuario(usuarioDe, p.user_id), actorLabel: nombre ? `${nombre} (Alboom)` : ACTOR_ALBOOM };
}

/** Historial `{created, user_id, stage_id (posición), stage_name, due_date, note}` → paso del recorrido. */
export function traducirPasoConsulta(c: Crudo, ctx: CtxHijosConsulta): Decision {
  const base = deLaConsulta(c, ctx);
  if (esDecision(base)) return base;
  const embudo = ctx.embudoDeLead.get(base.idLead);
  if (!embudo) return { accion: "OMITIR", motivo: DUDAS_8B2.sinCircuito };
  const p = campos(c.payload);
  const creado = instanteAr(p.created);
  if (!creado) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinFecha };
  const pos = entero(p.stage_id);
  const nota = [texto(p.stage_name, 120) ? `Etapa en Alboom: ${texto(p.stage_name, 120)}` : null, textoLargo(p.note, 2000)].filter(Boolean).join("\n");
  return {
    accion: "CREAR",
    datos: {
      subjectType: "CAPTACION",
      subjectId: base.lead,
      toStageId: pos !== null ? (ctx.etapaDe.get(`${embudo}/${pos}`) ?? null) : null,
      note: nota || null,
      ...autor(p, ctx.usuarioDe),
      createdAt: creado,
    },
    huellas: {},
  };
}

/** Nota `{user_id, action (categoría), text, created, customer_id}` → nota de la ficha del contacto. */
export function traducirNotaConsulta(c: Crudo, ctx: CtxHijosConsulta): Decision {
  const base = deLaConsulta(c, ctx);
  if (esDecision(base)) return base;
  const p = campos(c.payload);
  const cuerpo = htmlATexto(p.text ?? p.note, 8000);
  if (!cuerpo) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinTexto };
  const idCliente = id(p.customer_id);
  const clientId = (idCliente ? ctx.contactoDe.get(idCliente) : undefined) ?? ctx.clienteDeLead.get(base.idLead);
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const categoria = texto(p.action, 80);
  const { actorUserId, actorLabel } = autor(p, ctx.usuarioDe);
  return {
    accion: "CREAR",
    datos: {
      clientId,
      categoryId: categoria ? (ctx.categoriasNota.get(clave(categoria)) ?? null) : null,
      body: `Nota de la consulta ${base.idLead} (Alboom)${categoria ? ` · ${categoria}` : ""}\n${cuerpo}`,
      authorUserId: actorUserId,
      authorLabel: actorLabel,
      createdAt: instanteAr(p.created),
    },
    huellas: {},
  };
}

/** Actividad `{user_id, text, link, created}` → hecho de la línea de tiempo del contacto. */
export function traducirActividadConsulta(c: Crudo, ctx: CtxHijosConsulta): Decision {
  const base = deLaConsulta(c, ctx);
  if (esDecision(base)) return base;
  const p = campos(c.payload);
  const t = htmlATexto(p.text, 500);
  if (!t) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinTexto };
  const idCliente = id(p.customer_id);
  const clientId = (idCliente ? ctx.contactoDe.get(idCliente) : undefined) ?? ctx.clienteDeLead.get(base.idLead);
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  return {
    accion: "CREAR",
    datos: { clientId, kind: KIND_ACTIVIDAD, texto: t.replace(/\s+/g, " "), consulta: base.idLead, ...autor(p, ctx.usuarioDe), createdAt: instanteAr(p.created) },
    huellas: {},
  };
}

/** Correo o WhatsApp `{message_type, to_mail, subject, body, created}` → mensaje ya enviado de la ficha. */
export function traducirCorreoConsulta(c: Crudo, ctx: CtxHijosConsulta): Decision {
  const base = deLaConsulta(c, ctx);
  if (esDecision(base)) return base;
  const p = campos(c.payload);
  const idCliente = id(p.customer_id);
  const clientId = (idCliente ? ctx.contactoDe.get(idCliente) : undefined) ?? ctx.clienteDeLead.get(base.idLead);
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const whatsapp = clave(String(p.message_type ?? "")).includes("whats");
  const cuerpo = htmlATexto(p.body ?? p.message, 100_000);
  const asunto = texto(p.subject, 300);
  if (!cuerpo && !asunto) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinTexto };
  return {
    accion: "CREAR",
    datos: {
      clientId,
      channel: whatsapp ? "WHATSAPP" : "EMAIL",
      status: whatsapp ? "OPENED_WHATSAPP" : "SENT",
      toAddress: texto(p.to_mail ?? p.to, 300) ?? "(sin dirección en Alboom)",
      subject: whatsapp ? null : asunto,
      body: cuerpo ?? "(sin texto)",
      ...autor(p, ctx.usuarioDe),
      createdAt: instanteAr(p.created),
    },
    huellas: {},
  };
}
