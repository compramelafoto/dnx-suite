import { campos, clave, entero, esObjeto, fecha, idAlboom, siNo, texto, textoLargo } from "../normalizar";
import type { Crudo, Decision, EntradaMapa } from "../tipos";
import { ACTOR_ALBOOM, CORTE_FOTOFFICE, DUDAS_8B2, MOTIVOS_8B2, htmlATexto, huellaDato, instanteAr, padreDe, usuario, yaCargado } from "./historia";

/**
 * Contratos, proyectos (con historial y participantes), citas y tareas de Alboom (doc 03) → FOTOFFICE. Puro.
 *
 * Ninguno avisa ni manda nada: el contrato firmado nace "firmado fuera de FOTOFFICE" (`manualSignedAt`) y el no
 * firmado en BORRADOR sin versión ni firmantes (sin enlace ni recordatorio); el proyecto nace con su recorrido ya en
 * su etapa (sin tareas automáticas ni aviso de "listo"); la cita nace marcada como ya recordada y fuera de la
 * sincronización con Google; la tarea no avisa.
 */

export const TIPO_CONTRATO = "CONTRATO";
export const TIPO_PROYECTO = "PROYECTO";
export const TIPO_PARTICIPANTE = "PROYECTO_PARTICIPANTE";
export const TIPO_CITA = "CITA";
export const TIPO_TAREA = "TAREA";

export const EVENTO_CONTRATO_ALBOOM = "ALBOOM_HISTORICO";

const ESTADO_PROYECTO: Record<string, string> = { "200": "No empezado", "201": "En Proceso", "202": "Cancelado", "203": "Suspendido", "204": "Listo" };

// ── Contratos ───────────────────────────────────────────────────────────────────

export type CtxContratos = {
  pedidoDe: Map<string, string>;
  clienteDePedido: Map<string, string>;
  contactoDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  detalle: Map<string, Record<string, unknown>>;
  numeros: Set<string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

function firma(v: unknown): Record<string, unknown> {
  if (esObjeto(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try {
      const j: unknown = JSON.parse(v);
      return esObjeto(j) ? j : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function traducirContrato(c: Crudo, ctx: CtxContratos): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const det = ctx.detalle.get(c.alboomId);
  const p = { ...campos(c.payload), ...(det ? (esObjeto(det.agreement) ? (det.agreement as Record<string, unknown>) : det) : {}) };
  const idPedido = idAlboom(p.order_id);
  const pedidoId = idPedido ? ctx.pedidoDe.get(idPedido) : undefined;
  if (!idPedido || !pedidoId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinPedido };
  const idCliente = idAlboom(p.customer_id);
  const clientId = (idCliente ? ctx.contactoDe.get(idCliente) : undefined) ?? ctx.clienteDePedido.get(idPedido);
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const dudas: string[] = [];
  let number = c.alboomId;
  if (ctx.numeros.has(number)) {
    number = `ALB-${c.alboomId}`;
    dudas.push(DUDAS_8B2.numeroOcupado);
  }
  const s = firma(p.signature);
  const firmado1 = instanteAr(s.signed1);
  const firmado2 = instanteAr(s.signed2);
  const firmadoLegacy = typeof p.signed === "string" ? instanteAr(p.signed) : null;
  const firmado = firmado1 || firmado2 || firmadoLegacy || siNo(p.signed) === true;
  let signedAt = [firmado1, firmado2, firmadoLegacy].filter((x): x is string => !!x).sort().pop() ?? null;
  if (firmado && !signedAt) {
    signedAt = instanteAr(p.modified) ?? instanteAr(p.created);
    dudas.push(DUDAS_8B2.firmaSinFecha);
  }
  const enviado = instanteAr(p.sent_date);
  if (!firmado && enviado) dudas.push(DUDAS_8B2.enviadoSinFirmar);
  // Evidencia de la firma: fechas y huellas de la IP y de la imagen (nunca nombres ni la imagen: siguen en el crudo).
  const huellaDe = (v: unknown) => (typeof v === "string" && v.trim() ? huellaDato(v.trim()) : null);
  const evento: Record<string, string | boolean | null> = {
    alboomId: c.alboomId,
    enviado,
    visto: instanteAr(p.viewed),
    firmado: signedAt,
    acepto: s.agree === undefined ? null : siNo(s.agree) === true,
    firmante1Fecha: firmado1,
    firmante1Ip: huellaDe(s.ip1),
    firmante1Firma: huellaDe(s.signature1),
    firmante2Fecha: firmado2,
    firmante2Ip: huellaDe(s.ip2),
    firmante2Firma: huellaDe(s.signature2),
    legacy: siNo(p.legacy) === true,
    legacyIp: huellaDe(p.ip),
  };
  return {
    accion: "CREAR",
    datos: {
      pedidoId,
      clientId,
      number,
      name: (texto(p.name, 200) ?? `Contrato ${c.alboomId} de Alboom`).slice(0, 200),
      status: firmado ? "FIRMADO" : "BORRADOR",
      bodyText: htmlATexto(p.text) ?? "(Contrato de Alboom sin texto)",
      signedAt: firmado ? signedAt : null,
      manualSignedAt: firmado ? signedAt : null,
      ownerUserId: usuario(ctx.usuarioDe, p.user_id),
      createdAt: instanteAr(p.created),
    },
    extra: { evento },
    huellas: {},
    ...(dudas.length ? { dudas } : {}),
  };
}

export function registrarNumero(numeros: Set<string>, d: Decision): void {
  if (d.accion === "CREAR" && d.datos) numeros.add(String(d.datos.number));
}

// ── Proyectos ───────────────────────────────────────────────────────────────────

export type CtxProyectos = {
  contactoDe: Map<string, string>;
  pedidoDe: Map<string, string>;
  clienteDePedido: Map<string, string>;
  /** Id de Alboom del flujo → circuito de TRABAJO. */
  circuitoDe: Map<string, string>;
  /** "<flujo>/<posición>" → etapa. */
  etapaDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  numeros: Set<string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

export function traducirProyecto(c: Crudo, ctx: CtxProyectos): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const idPedido = idAlboom(p.order_id);
  const idCliente = idAlboom(p.customer_id);
  const clientId = (idCliente ? ctx.contactoDe.get(idCliente) : undefined) ?? (idPedido ? ctx.clienteDePedido.get(idPedido) : undefined);
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const idFlujo = idAlboom(p.pipeline_id);
  const circuitId = idFlujo ? ctx.circuitoDe.get(idFlujo) : undefined;
  if (!circuitId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.flujoSinCargar };
  const dudas: string[] = [];
  let number = c.alboomId;
  if (ctx.numeros.has(number)) {
    number = `ALB-${c.alboomId}`;
    dudas.push(DUDAS_8B2.numeroOcupado);
  }
  const estado = idAlboom(p.status_id) ?? "200";
  const abierto = estado === "200" || estado === "201" || estado === "203";
  const outcome = abierto ? null : estado === "202" ? "CANCELADO" : "TERMINADO";
  const pos = entero(p.stage_id);
  let stageId = pos !== null ? (ctx.etapaDe.get(`${idFlujo}/${pos}`) ?? null) : null;
  let primeraEtapa = false;
  if (abierto && !stageId) {
    primeraEtapa = true;
    dudas.push(DUDAS_8B2.sinEtapa);
  }
  if (!abierto) stageId = null;
  const creado = instanteAr(p.created) ?? instanteAr(p.modified);
  const evento = fecha(p.event_date);
  const base = evento ?? fecha(p.start_date) ?? fecha(p.started_date) ?? fecha(p.created) ?? CORTE_FOTOFFICE;
  const descripcion = [
    textoLargo(p.description, 4000),
    textoLargo(p.products, 2000) ? `Productos a entregar: ${textoLargo(p.products, 2000)}` : null,
    textoLargo(p.archive, 1000) ? `Archivado en: ${textoLargo(p.archive, 1000)}` : null,
    texto(p.tags) ? `Etiquetas: ${texto(p.tags)}` : null,
    texto(p.priority_name) ? `Prioridad: ${texto(p.priority_name)}` : null,
    `Estado en Alboom: ${ESTADO_PROYECTO[estado] ?? estado}`,
    ...["extra1", "extra2", "extra3", "extra4", "extra_date1", "extra_date2"].flatMap((k) => (texto(p[k]) ? [`Campo ${k}: ${texto(p[k])}`] : [])),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    accion: "CREAR",
    datos: {
      number,
      name: (texto(p.name, 200) ?? `Proyecto ${c.alboomId} de Alboom`).slice(0, 200),
      clientId,
      pedidoId: idPedido ? (ctx.pedidoDe.get(idPedido) ?? null) : null,
      circuitId,
      eventDate: evento,
      baseDate: base,
      finalDueDate: fecha(p.final_due_date),
      ownerUserId: usuario(ctx.usuarioDe, p.user_id),
      delegateUserId: usuario(ctx.usuarioDe, p.delegated_id),
      description: descripcion || null,
      suspendedAt: estado === "203" ? (instanteAr(p.completed_date) ?? instanteAr(p.modified) ?? creado) : null,
      suspendReason: estado === "203" ? "Suspendido en Alboom" : null,
      externalId: `alboom:${c.alboomId}`,
      createdAt: creado,
      stageId,
      primeraEtapa,
      outcome,
      closedAt: abierto ? null : (instanteAr(p.completed_date) ?? instanteAr(p.modified) ?? creado),
      enteredStageAt: creado,
      stageDueAt: abierto ? instanteAr(p.due_date) : null,
    },
    huellas: {},
    ...(dudas.length ? { dudas } : {}),
  };
}

export type CtxHijosProyecto = {
  proyectoDe: Map<string, string>;
  /** Id de Alboom del proyecto → su flujo de Alboom. */
  flujoDeProyecto: Map<string, string>;
  etapaDe: Map<string, string>;
  contactoDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  /** Nombre normalizado del rol de proyecto → id. */
  rolPorNombre: Map<string, string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

/** Historial `{created, user_id, stage_id (posición), stage_name, due_date, note}` → paso del recorrido del proyecto. */
export function traducirPasoProyecto(c: Crudo, ctx: CtxHijosProyecto): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const idProyecto = padreDe(c.alboomId);
  const proyecto = idProyecto ? ctx.proyectoDe.get(idProyecto) : undefined;
  if (!idProyecto || !proyecto) return { accion: "OMITIR", motivo: MOTIVOS_8B2.proyectoSinCargar };
  const p = campos(c.payload);
  const creado = instanteAr(p.created);
  if (!creado) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinFecha };
  const pos = entero(p.stage_id);
  const flujo = ctx.flujoDeProyecto.get(idProyecto);
  const nombre = [texto(p.user_name, 80), texto(p.user_lastname, 80)].filter(Boolean).join(" ");
  const nota = [texto(p.stage_name, 120) ? `Etapa en Alboom: ${texto(p.stage_name, 120)}` : null, fecha(p.due_date) ? `Vencimiento: ${fecha(p.due_date)}` : null, textoLargo(p.note, 2000)]
    .filter(Boolean)
    .join("\n");
  return {
    accion: "CREAR",
    datos: {
      subjectType: "PROYECTO",
      subjectId: proyecto,
      toStageId: flujo && pos !== null ? (ctx.etapaDe.get(`${flujo}/${pos}`) ?? null) : null,
      note: nota || null,
      actorUserId: usuario(ctx.usuarioDe, p.user_id),
      actorLabel: nombre ? `${nombre} (Alboom)` : ACTOR_ALBOOM,
      createdAt: creado,
    },
    huellas: {},
  };
}

/** Participante `{contact_id, category_id, category_name, memo}` → participante del proyecto. */
export function traducirParticipante(c: Crudo, ctx: CtxHijosProyecto): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const idProyecto = padreDe(c.alboomId) ?? idAlboom(p.target_id);
  const proyectoId = idProyecto ? ctx.proyectoDe.get(idProyecto) : undefined;
  if (!proyectoId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.proyectoSinCargar };
  const idContacto = idAlboom(p.contact_id ?? p.customer_id);
  const clientId = idContacto ? ctx.contactoDe.get(idContacto) : undefined;
  if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
  const rol = texto(p.category_name, 120);
  const roleId = rol ? (ctx.rolPorNombre.get(clave(rol)) ?? null) : null;
  return {
    accion: "CREAR",
    datos: { proyectoId, clientId, roleId, note: [roleId ? null : rol, textoLargo(p.memo, 1000)].filter(Boolean).join(" · ") || null },
    huellas: {},
    ...(rol && !roleId ? { dudas: [DUDAS_8B2.rolSinCargar] } : {}),
  };
}

// ── Citas ───────────────────────────────────────────────────────────────────────

const ESTADO_CITA: Record<string, string> = {
  scheduled: "AGENDADA",
  rescheduled: "AGENDADA",
  confirmed: "CONFIRMADA",
  "on going": "CONFIRMADA",
  ongoing: "CONFIRMADA",
  completed: "REALIZADA",
  cancelled: "ANULADA",
  canceled: "ANULADA",
};

export type CtxCitas = {
  contactoDe: Map<string, string>;
  pedidoDe: Map<string, string>;
  proyectoDe: Map<string, string>;
  leadDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  /** Id de Alboom del tipo de cita → su nombre (`tipos_cita`). */
  tipoNombreDe: Map<string, string>;
  /** Nombre normalizado → tipo de cita de FOTOFFICE. */
  tipoPorNombre: Map<string, string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

function idsDeLista(v: unknown): string[] {
  const lista = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;\s]+/) : [];
  return [...new Set(lista.map((x) => idAlboom(esObjeto(x) ? (x.user_id ?? x.id) : x)).filter((x): x is string => !!x))];
}

export function traducirCita(c: Crudo, ctx: CtxCitas): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const titulo = texto(p.title, 200);
  if (!titulo) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinTitulo };
  const inicio = instanteAr(p.start ?? p.start_date);
  if (!inicio) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinFecha };
  const dudas: string[] = [];
  const todoElDia = siNo(p.all_day) === true;
  let fin = instanteAr(p.end ?? p.end_date);
  if (todoElDia && fin && fin <= inicio) fin = new Date(new Date(inicio).getTime() + 24 * 3600_000).toISOString();
  if (!fin || fin <= inicio) {
    if (fin) dudas.push(DUDAS_8B2.fechaFin);
    fin = new Date(new Date(inicio).getTime() + 3600_000).toISOString();
  }
  const idTipo = idAlboom(p.event_type_id);
  const nombreTipo = texto(p.event_type_name) ?? (idTipo ? ctx.tipoNombreDe.get(idTipo) : undefined) ?? null;
  const typeId = nombreTipo ? (ctx.tipoPorNombre.get(clave(nombreTipo)) ?? null) : null;
  if (nombreTipo && !typeId) dudas.push(DUDAS_8B2.tipoCitaSinCargar);
  const tipo = clave(String(p.type ?? ""));
  const target = idAlboom(p.target_id);
  const idCliente = idAlboom(p.customer_id);
  const participantes = idsDeLista(p.participants_list).map((u) => usuario(ctx.usuarioDe, u)).filter((u): u is number => u !== null);
  const notas = [htmlATexto(p.details, 8000), nombreTipo && !typeId ? `Tipo en Alboom: ${nombreTipo}` : null].filter(Boolean).join("\n");
  return {
    accion: "CREAR",
    datos: {
      title: titulo,
      typeId,
      status: ESTADO_CITA[clave(String(p.status ?? ""))] ?? "AGENDADA",
      startAt: inicio,
      endAt: fin,
      allDay: todoElDia,
      location: texto(p.location, 300),
      notes: notas || null,
      ownerUserId: usuario(ctx.usuarioDe, p.user_id),
      clientId: idCliente ? (ctx.contactoDe.get(idCliente) ?? null) : null,
      pedidoId: target && tipo === "orders" ? (ctx.pedidoDe.get(target) ?? null) : null,
      proyectoId: target && tipo === "projects" ? (ctx.proyectoDe.get(target) ?? null) : null,
      consultaLeadId: target && tipo === "leads" ? (ctx.leadDe.get(target) ?? null) : null,
      createdAt: instanteAr(p.created),
    },
    extra: { participantes: [...new Set(participantes)] },
    huellas: {},
    ...(dudas.length ? { dudas } : {}),
  };
}

// ── Tareas ──────────────────────────────────────────────────────────────────────

export type CtxTareas = {
  leadDe: Map<string, string>;
  proyectoDe: Map<string, string>;
  pedidoDe: Map<string, string>;
  contactoDe: Map<string, string>;
  usuarioDe: Map<string, string>;
  existentes: Set<string>;
  mapa: Map<string, EntradaMapa>;
};

/**
 * Tarea `{id, user_id, type, target_id, title, due_date, completed}`: de una oportunidad o un proyecto → tarea de su
 * recorrido; de un pedido → checklist del pedido; de un contacto → nota en su ficha; suelta → sin destino.
 */
export function traducirTarea(c: Crudo, ctx: CtxTareas): Decision {
  const ya = yaCargado(c, ctx.mapa.get(c.alboomId), (x) => ctx.existentes.has(x));
  if (ya) return ya;
  const p = campos(c.payload);
  const titulo = texto(p.title, 200);
  if (!titulo) return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinTitulo };
  const tipo = clave(String(p.type ?? ""));
  const target = idAlboom(p.target_id);
  const hecha = siNo(p.completed) === true;
  const vence = instanteAr(p.due_date);
  const doneAt = hecha ? (instanteAr(p.completed_date) ?? instanteAr(p.modified) ?? vence ?? instanteAr(`${CORTE_FOTOFFICE} 12:00:00`)) : null;
  const comun = { title: titulo, dueAt: vence, assigneeUserId: usuario(ctx.usuarioDe, p.user_id), doneAt, createdAt: instanteAr(p.created) };
  if (target && tipo === "leads") {
    const lead = ctx.leadDe.get(target);
    if (!lead) return { accion: "OMITIR", motivo: MOTIVOS_8B2.consultaSinCargar };
    return { accion: "CREAR", datos: { destino: "TAREA", subjectType: "CAPTACION", subjectId: lead, ...comun }, huellas: {} };
  }
  if (target && tipo === "projects") {
    const proyecto = ctx.proyectoDe.get(target);
    if (!proyecto) return { accion: "OMITIR", motivo: MOTIVOS_8B2.proyectoSinCargar };
    return { accion: "CREAR", datos: { destino: "TAREA", subjectType: "PROYECTO", subjectId: proyecto, ...comun }, huellas: {} };
  }
  if (target && tipo === "orders") {
    const pedidoId = ctx.pedidoDe.get(target);
    if (!pedidoId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.pedidoSinCargar };
    return { accion: "CREAR", datos: { destino: "PEDIDO_TAREA", pedidoId, title: titulo, doneAt, doneByUserId: hecha ? comun.assigneeUserId : null }, huellas: {} };
  }
  if (target && tipo === "contacts") {
    const clientId = ctx.contactoDe.get(target);
    if (!clientId) return { accion: "OMITIR", motivo: MOTIVOS_8B2.contactoSinCargar };
    const body = [`Tarea de Alboom: ${titulo}`, vence ? `Vencimiento: ${fecha(p.due_date)}` : null, hecha ? "Hecha" : "Pendiente"].filter(Boolean).join("\n");
    return { accion: "CREAR", datos: { destino: "NOTA", clientId, body, authorUserId: comun.assigneeUserId, authorLabel: ACTOR_ALBOOM, createdAt: comun.createdAt }, huellas: {} };
  }
  return { accion: "OMITIR", motivo: MOTIVOS_8B2.sinDestino };
}
