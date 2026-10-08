import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puedeEnContexto, type AccesoEfectivo } from "@/lib/access/policy";
import { moduloDeTipo } from "@/lib/access/modulos-crm";
import { sendTransactionalEmail, type OutboundEmail, type SendOutcome } from "@/lib/communications/send-email";
import { buildWhatsappUrl, normalizeWhatsappNumber } from "@/lib/contact/whatsapp";
import {
  CARACTER_MARCADOR, CLAVE_FIRMA, CODIGO_ENVIO_EN_CURSO, MARCADOR_FIRMA, MAX_ASUNTO, MAX_CUERPO, TOPE_AUTOMATICOS_DIA, TOPE_CORREOS_DIA,
  VIDA_RESERVA_MS, ZONA_HORARIA, type Canal, type ClaveAutomatico,
  type TipoPlantilla,
} from "./constantes";
import { conListaDePrecios, contextoDe, correoValido, type ContextoMensaje, type TipoFichaMensaje } from "./contexto";
import { plantillaParaUsar } from "./definiciones";
import { analizar, completar, tieneMarcadorSinCompletar } from "./motor";
import { cuerpoCorreoHtml, cuerpoCorreoTexto, textoWhatsapp } from "./render";
import { clavesPermitidas, resolverVariables } from "./variables";

/**
 * Envío de mensajes desde una ficha: correo con `sendTransactionalEmail` (nunca lanza), enlace de
 * WhatsApp, registro en `FotofficeMessage` y tope diario. Nunca se loguean direcciones, números
 * ni cuerpos: sólo códigos.
 */

/** Quién envía. `role` se exige (`operar`) salvo en los automáticos, que no tienen usuario. */
export type CtxEnvio = {
  workspaceId: string;
  userId: number | null;
  userLabel: string | null;
  userName?: string | null;
  userEmail?: string | null;
  role: string | null;
  /** Acceso efectivo (modelo de main); `operar` se mide sobre el módulo del registro. */
  acceso?: AccesoEfectivo;
};

export const MENSAJES_ENVIO = {
  sinPermiso: "No tenés permiso para enviar mensajes.",
  noEncontrado: "No encontramos ese registro.",
  plantillaNoEncontrada: "No encontramos esa plantilla.",
  plantillaConErrores: "La plantilla tiene variables que ya no se pueden usar: revisala en Configuración → Plantillas.",
  sinCorreo: "Esta persona no tiene un correo válido cargado.",
  sinWhatsapp: "Esta persona no tiene un teléfono válido para WhatsApp (con código de país).",
  asunto: `Poné un asunto de hasta ${MAX_ASUNTO} caracteres.`,
  cuerpoVacio: "Escribí el texto del mensaje.",
  marcadorSinCompletar: "Completá los textos entre corchetes en mayúsculas antes de enviar.",
  tope: `Llegaste al tope de ${TOPE_CORREOS_DIA} correos por día de la organización. Podés volver a enviar mañana.`,
  topeAutomaticos: `Se llegó al tope de ${TOPE_AUTOMATICOS_DIA} correos automáticos por día de la organización.`,
  datosInvalidos: "Los datos no son válidos.",
  falloRegistro: "No pudimos registrar el mensaje. Probá de nuevo.",
  falloConfiguracion: "El envío de correos no está configurado. Avisale a quien administra FOTOFFICE.",
  falloProveedor: "El proveedor de correo rechazó el envío.",
  falloConexion: "No pudimos conectar con el proveedor de correo. Probá de nuevo en un rato.",
} as const;

const variableSinCompletar = (token: string) => `Quedó una variable sin completar: ${token}`;
const cuerpoLargo = (canal: Canal) =>
  `El texto puede tener hasta ${MAX_CUERPO[canal].toLocaleString("es-AR")} caracteres en ${canal === "EMAIL" ? "Correo" : "WhatsApp"}.`;

type Falla = { ok: false; error: string };
const no = (error: string): Falla => ({ ok: false, error });

function usuarioDe(ctx: CtxEnvio) {
  return { nombre: ctx.userName ?? ctx.userLabel ?? null, email: ctx.userEmail ?? null };
}


// ─── Preparar ────────────────────────────────────────────────────────────────

export type MensajePreparado = {
  ok: true;
  asunto: string;
  cuerpo: string;
  /** Variables que quedaron vacías (sin repetir), para marcarlas en el panel. */
  vacias: string[];
  /** Si el texto todavía tiene `[TEXTO EN MAYÚSCULAS]` por completar a mano. */
  pendientes: boolean;
  /** Adónde iría (para el panel): correo o teléfono de la persona. */
  destino: { email: string | null; telefono: string | null };
};

/**
 * Completa asunto y cuerpo con los datos del registro. `[firma]` queda escrita tal cual en el cuerpo
 * (el envío la resuelve), y en el asunto se quita. Puro sobre un contexto ya cargado.
 */
export function completarTextos(
  contexto: ContextoMensaje,
  tipo: TipoPlantilla,
  asunto: string | null,
  cuerpo: string,
): { ok: true; asunto: string; cuerpo: string; vacias: string[] } | Falla {
  const permitidas = clavesPermitidas(tipo, contexto.camposActivos);
  const crudos = resolverVariables(contexto.variables);
  // Los corchetes de un dato (un nombre como "[Estudio]") no son marcadores: se vuelven paréntesis
  // para que el envío no los confunda con variables o textos por completar.
  const valores = (clave: string) => crudos(clave)?.replace(/\[/g, "(").replace(/\]/g, ")") ?? null;
  const rCuerpo = analizar(cuerpo, permitidas);
  const rAsunto = asunto ? analizar(asunto, permitidas) : null;
  if (!rCuerpo.ok || (rAsunto && !rAsunto.ok)) return no(MENSAJES_ENVIO.plantillaConErrores);
  const c = completar(rCuerpo.piezas, valores);
  const a = rAsunto?.ok ? completar(rAsunto.piezas, valores) : null;
  const vacias = [...new Set([...(a?.vacias ?? []), ...c.vacias])];
  return {
    ok: true,
    asunto: a ? a.texto.split(MARCADOR_FIRMA).join("").replace(/\s+/g, " ").trim() : "",
    cuerpo: c.texto.split(MARCADOR_FIRMA).join(`[${CLAVE_FIRMA}]`),
    vacias,
  };
}

/**
 * Asunto y cuerpo para el panel, con la plantilla elegida (del workspace, activa, del canal y de
 * la ficha o GENERAL) o vacíos para escribir a mano. No escribe nada.
 */
export async function prepararMensaje(
  ctx: CtxEnvio,
  datos: { canal: Canal; entityType: TipoFichaMensaje; entityId: string; templateId?: string | null },
): Promise<MensajePreparado | Falla> {
  const contexto = await contextoDe(ctx.workspaceId, datos.entityType, datos.entityId, usuarioDe(ctx));
  if (!contexto) return no(MENSAJES_ENVIO.noEncontrado);
  if (datos.templateId == null || datos.templateId === "") {
    return { ok: true, asunto: "", cuerpo: "", vacias: [], pendientes: false, destino: contexto.destino };
  }
  const plantilla = await plantillaParaUsar(ctx.workspaceId, datos.templateId, datos.canal, datos.entityType);
  if (!plantilla) return no(MENSAJES_ENVIO.plantillaNoEncontrada);
  const conLista = await conListaDePrecios(ctx.workspaceId, contexto, plantilla.subject, plantilla.body);
  const r = completarTextos(conLista, datos.entityType, datos.canal === "EMAIL" ? plantilla.subject : null, plantilla.body);
  if (!r.ok) return r;
  return {
    ...r,
    pendientes: tieneMarcadorSinCompletar(r.asunto) || tieneMarcadorSinCompletar(r.cuerpo),
    destino: contexto.destino,
  };
}

// ─── Validación del texto final ──────────────────────────────────────────────

/** El primer `[…]` desde la posición del error, para nombrarlo en el mensaje. */
function tokenEn(texto: string, posicion: number): string {
  return texto.slice(posicion).match(/^\[[^\]\n]{0,60}\]/)?.[0] ?? "[…]";
}

/**
 * El texto final ya viene completado y retocado por quien envía. Se vuelve a analizar sólo con
 * `[firma]` permitida: cualquier otra variable o bloque que quedó es un error. Devuelve las
 * piezas completadas (la firma como marcador) o el error.
 */
function textoFinal(texto: string, conFirma: boolean): { ok: true; texto: string; conFirma: boolean } | Falla {
  const r = analizar(texto, new Set(conFirma ? [CLAVE_FIRMA] : []));
  if (!r.ok) return no(variableSinCompletar(tokenEn(texto, r.errores[0]!.posicion)));
  const c = completar(r.piezas, () => null);
  return { ok: true, texto: c.texto, conFirma: c.conFirma };
}

function validarCuerpo(cuerpo: unknown, canal: Canal): { ok: true; cuerpo: string } | Falla {
  if (typeof cuerpo !== "string") return no(MENSAJES_ENVIO.cuerpoVacio);
  const t = cuerpo.replace(/\r\n?/g, "\n").trim();
  if (!t) return no(MENSAJES_ENVIO.cuerpoVacio);
  if (t.length > MAX_CUERPO[canal]) return no(cuerpoLargo(canal));
  return { ok: true, cuerpo: t };
}

/** La plantilla usada, si vino: del workspace y válida para el canal y la ficha (o la automática). */
async function validarPlantilla(
  workspaceId: string,
  templateId: unknown,
  canal: Canal,
  tipo: TipoPlantilla,
  automatico: boolean,
): Promise<{ ok: true; id: string | null } | Falla> {
  if (templateId === undefined || templateId === null || templateId === "") {
    // Un automático siempre sale de su plantilla: sin ella, no se envía.
    return automatico ? no(MENSAJES_ENVIO.plantillaNoEncontrada) : { ok: true, id: null };
  }
  if (typeof templateId !== "string" || templateId.length > 100) return no(MENSAJES_ENVIO.plantillaNoEncontrada);
  // Etapa 2, Entrega B: la propuesta modelo que sale sola va con una plantilla común de correo de
  // PRESUPUESTO del workspace, y el seguimiento con la automática `PRESUPUESTO_SEGUIMIENTO`
  // (encendida). Sólo el código del servidor pide ese tipo (`opciones.tipoPlantilla`).
  if (automatico && tipo === "PRESUPUESTO") {
    const f = await prisma.fotofficeMessageTemplate.findFirst({
      where: {
        id: templateId, workspaceId, channel: canal, entityType: "PRESUPUESTO", archivedAt: null,
        OR: [{ systemKey: null }, { systemKey: CLAVE_SEGUIMIENTO, enabled: true }],
      },
      select: { id: true },
    });
    return f ? { ok: true, id: f.id } : no(MENSAJES_ENVIO.plantillaNoEncontrada);
  }
  // Etapa 3: el recibo de un cobro sale con la automática `RECIBO_DE_PAGO` y el recordatorio de
  // una cuota con `RECORDATORIO_CUOTA` (Entrega B1), encendidas.
  if (automatico && tipo === "PEDIDO") {
    const f = await prisma.fotofficeMessageTemplate.findFirst({
      where: {
        id: templateId, workspaceId, channel: canal, entityType: "PEDIDO", systemKey: { in: [CLAVE_RECIBO, CLAVE_RECORDATORIO] }, enabled: true,
        archivedAt: null,
      },
      select: { id: true },
    });
    return f ? { ok: true, id: f.id } : no(MENSAJES_ENVIO.plantillaNoEncontrada);
  }
  if (automatico) {
    const f = await prisma.fotofficeMessageTemplate.findFirst({
      where: {
        // Sólo la respuesta automática sale a la persona de la ficha: el aviso al equipo
        // (`CONSULTA_AVISO_EQUIPO`) nunca pasa por acá.
        id: templateId, workspaceId, channel: canal, entityType: tipo, systemKey: CLAVE_RESPUESTA_A_LA_PERSONA, enabled: true,
        archivedAt: null,
      },
      select: { id: true },
    });
    return f ? { ok: true, id: f.id } : no(MENSAJES_ENVIO.plantillaNoEncontrada);
  }
  const p = await plantillaParaUsar(workspaceId, templateId, canal, tipo);
  return p ? { ok: true, id: p.id } : no(MENSAJES_ENVIO.plantillaNoEncontrada);
}

/** La única automática que va a la persona de la ficha. */
const CLAVE_RESPUESTA_A_LA_PERSONA: ClaveAutomatico = "CONSULTA_AUTORESPUESTA";
/** El seguimiento de un presupuesto (Entrega B): también va a la persona de la consulta. */
const CLAVE_SEGUIMIENTO: ClaveAutomatico = "PRESUPUESTO_SEGUIMIENTO";
/** El recibo de un cobro (etapa 3): va al contacto del pedido. */
const CLAVE_RECIBO: ClaveAutomatico = "RECIBO_DE_PAGO";
/** El recordatorio del vencimiento de una cuota (Entrega B1): va al contacto del pedido. */
const CLAVE_RECORDATORIO: ClaveAutomatico = "RECORDATORIO_CUOTA";

/**
 * Asunto, HTML y texto listos para el transporte a partir de textos ya completados
 * (`completarTextos`), con las mismas validaciones que `enviarCorreo`: asunto de una línea,
 * cuerpo no vacío, sin textos por completar ni variables sueltas; `[firma]` se reemplaza por la
 * firma dada. Lo usa el aviso interno al equipo, que no pasa por `enviarCorreo` (va a un usuario
 * del equipo, no a la persona de la ficha, y no se registra ni cuenta en los topes).
 */
export function armarCorreoFinal(
  asunto: string,
  cuerpo: string,
  firma: { html: string; texto: string },
): { ok: true; asunto: string; html: string; texto: string } | Falla {
  const a = asunto.replace(/\s+/g, " ").trim();
  if (!a || a.length > MAX_ASUNTO) return no(MENSAJES_ENVIO.asunto);
  const vc = validarCuerpo(cuerpo, "EMAIL");
  if (!vc.ok) return vc;
  if (tieneMarcadorSinCompletar(a) || tieneMarcadorSinCompletar(vc.cuerpo)) return no(MENSAJES_ENVIO.marcadorSinCompletar);
  const fa = textoFinal(a, false);
  if (!fa.ok) return fa;
  const fc = textoFinal(vc.cuerpo, true);
  if (!fc.ok) return fc;
  return {
    ok: true,
    asunto: fa.texto,
    html: cuerpoCorreoHtml(fc.texto, firma.html, fc.conFirma),
    texto: cuerpoCorreoTexto(fc.texto, firma.texto, fc.conFirma),
  };
}

// ─── Tope diario ─────────────────────────────────────────────────────────────

/** Comienzo del día de hoy en Buenos Aires (UTC−3 fijo: Argentina no tiene horario de verano). */
export function inicioDelDiaAR(ahora: Date): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value]),
  );
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00.000-03:00`);
}

/**
 * Filtro que deja afuera los avisos internos al equipo (`CONSULTA_AVISO_EQUIPO`), que se
 * registran en `FotofficeMessage` con la plantilla del aviso pero tienen su propio tope y nunca
 * cuentan como respuesta a una persona. Se distinguen por `templateId`: es la única marca que no
 * necesita columnas nuevas. `{}` si el workspace todavía no tiene la plantilla del aviso.
 */
export async function sinAvisosAlEquipo(workspaceId: string): Promise<Prisma.FotofficeMessageWhereInput> {
  const aviso = await prisma.fotofficeMessageTemplate.findFirst({
    where: { workspaceId, systemKey: "CONSULTA_AVISO_EQUIPO" },
    select: { id: true },
  });
  // `not` de Prisma deja afuera los null: se suman a mano los mensajes sin plantilla.
  return aviso ? { OR: [{ templateId: null }, { templateId: { not: aviso.id } }] } : {};
}

/**
 * Correos enviados (`SENT`) hoy por la organización: los manuales o, con `automaticos`, los
 * automáticos (sin los avisos al equipo, que tienen su propio tope). Cada grupo tiene su propio
 * tope. Usa el índice (workspaceId, channel, createdAt).
 */
export async function correosEnviadosHoy(workspaceId: string, ahora: Date, automaticos = false): Promise<number> {
  return prisma.fotofficeMessage.count({
    where: {
      workspaceId, channel: "EMAIL", createdAt: { gte: inicioDelDiaAR(ahora) }, status: "SENT", automatic: automaticos,
      ...(automaticos ? await sinAvisosAlEquipo(workspaceId) : {}),
    },
  });
}

// ─── Correo ──────────────────────────────────────────────────────────────────

/**
 * Para envíos de otro módulo desde la ficha (hoy: el presupuesto, etapa 2). Sólo código del
 * servidor los pasa (nunca lo que llega de un formulario):
 * - `modulo`: el módulo cuyo "Gestionar" se exige en vez del de la ficha;
 * - `tipoPlantilla`: el tipo de plantilla válido (PRESUPUESTO) en vez del de la ficha.
 */
export type OpcionesDeEnvio = { modulo?: string; tipoPlantilla?: TipoPlantilla };

export type DepsEnvio = {
  /** Inyectable en las pruebas: nunca se manda un correo real desde un test. */
  enviar?: (mensaje: OutboundEmail) => Promise<SendOutcome>;
  ahora?: () => Date;
};

export type ResultadoEnvio = { ok: true; mensajeId: string } | { ok: false; error: string; registrado?: boolean };

/** Código para guardar (nunca el detalle, que puede traer datos): estado + HTTP + nombre del error. */
function codigoDeError(r: Exclude<SendOutcome, { status: "SENT" }>): string {
  if (r.status !== "PROVIDER_REJECTED") return r.status;
  const m = r.detail.match(/^HTTP (\d{3})(?: · ([a-z_]{1,60}))?/);
  return ["PROVIDER_REJECTED", m?.[1], m?.[2]].filter(Boolean).join(":");
}

function mensajeDeFalla(r: Exclude<SendOutcome, { status: "SENT" }>): string {
  if (r.status === "CONFIGURATION_ERROR") return MENSAJES_ENVIO.falloConfiguracion;
  if (r.status === "PROVIDER_REJECTED") return MENSAJES_ENVIO.falloProveedor;
  return MENSAJES_ENVIO.falloConexion;
}

export type DatosCorreo = {
  entityType: TipoFichaMensaje;
  entityId: string;
  templateId?: string | null;
  asunto: unknown;
  cuerpo: unknown;
  automatico?: boolean;
  /**
   * Sólo los automáticos de presupuestos (Entrega B) y el recibo de pago (etapa 3), desde el servidor:
   * - `registroId`: la reserva que ya hicieron (`reservarEnvioAutomatico`, con su candado); el
   *   registro la completa en vez de crear otra fila;
   * - `registrarEn`: la ficha donde queda el registro, si no es la del destinatario (el
   *   seguimiento queda en el presupuesto, `PRESUPUESTO` + su id, para contarlo por presupuesto; el
   *   recibo de pago, en el pedido, `PEDIDO` + su id).
   */
  registroId?: string;
  registrarEn?: { entityType: "PRESUPUESTO" | "PEDIDO"; entityId: string };
};

export { CODIGO_ENVIO_EN_CURSO };

/** Filtro: sin las reservas abandonadas (EN_CURSO de hace más de `VIDA_RESERVA_MS`). */
export function sinReservasViejas(ahora: Date): Prisma.FotofficeMessageWhereInput {
  return {
    OR: [
      { errorCode: null },
      { errorCode: { not: CODIGO_ENVIO_EN_CURSO } },
      { createdAt: { gte: new Date(ahora.getTime() - VIDA_RESERVA_MS) } },
    ],
  };
}

/**
 * Candado por organización y dirección (dentro de una transacción): lo toman todas las respuestas
 * automáticas a una persona (la común, la propuesta modelo y el seguimiento) antes de mirar la
 * regla de 24 h y reservar, así dos a la vez no le mandan dos correos.
 */
export async function candadoDeDireccion(tx: Pick<Prisma.TransactionClient, "$executeRaw">, workspaceId: string, email: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-respuesta-web:${workspaceId}:${email.trim().toLowerCase()}`}))`;
}

/**
 * Reserva el registro de un envío automático ANTES de mandarlo (dentro de la transacción que tiene
 * el candado de quien llama): una fila FALLIDA con el código `EN_CURSO` que cuenta para la regla
 * de una respuesta por dirección cada 24 h y para "ya se mandó", así otra corrida o un pedido
 * simultáneo no manda lo mismo. `enviarCorreo` (con `registroId`) la completa; si no llega a
 * enviarse, quien reservó la borra (`liberarReserva`).
 */
export async function reservarEnvioAutomatico(
  cliente: Pick<Prisma.TransactionClient, "fotofficeMessage">,
  datos: { workspaceId: string; entityType: string; entityId: string; templateId: string | null; toAddress: string },
): Promise<string> {
  const fila = await cliente.fotofficeMessage.create({
    data: {
      workspaceId: datos.workspaceId,
      channel: "EMAIL",
      entityType: datos.entityType,
      entityId: datos.entityId,
      templateId: datos.templateId,
      toAddress: datos.toAddress,
      subject: null,
      body: "",
      status: "FAILED",
      automatic: true,
      errorCode: CODIGO_ENVIO_EN_CURSO,
      actorUserId: null,
      actorLabel: "Automático",
    },
    select: { id: true },
  });
  return fila.id;
}

/** Borra una reserva que no se llegó a usar (sigue `EN_CURSO`). Nunca lanza. */
export async function liberarReserva(workspaceId: string, id: string): Promise<void> {
  try {
    await prisma.fotofficeMessage.deleteMany({ where: { id, workspaceId, errorCode: CODIGO_ENVIO_EN_CURSO } });
  } catch (e) {
    console.error("[plantillas] no se pudo liberar una reserva de envío", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
  }
}

/**
 * Envía un correo a la persona del registro y lo registra (`SENT` o `FAILED`). El tope diario se
 * mira antes: al llegar, no se envía ni se registra. Una falla del proveedor queda registrada
 * con su código y no se reintenta.
 */
export async function enviarCorreo(ctx: CtxEnvio, datos: DatosCorreo, deps: DepsEnvio = {}, opciones: OpcionesDeEnvio = {}): Promise<ResultadoEnvio> {
  const automatico = datos.automatico === true;
  if (!automatico && !puedeEnContexto(ctx, "operar", opciones.modulo ?? moduloDeTipo(datos.entityType))) return no(MENSAJES_ENVIO.sinPermiso);

  if (typeof datos.asunto !== "string") return no(MENSAJES_ENVIO.asunto);
  const asunto = datos.asunto.replace(/\s+/g, " ").trim();
  if (!asunto || asunto.length > MAX_ASUNTO) return no(MENSAJES_ENVIO.asunto);
  const vc = validarCuerpo(datos.cuerpo, "EMAIL");
  if (!vc.ok) return vc;
  if (tieneMarcadorSinCompletar(asunto) || tieneMarcadorSinCompletar(vc.cuerpo)) return no(MENSAJES_ENVIO.marcadorSinCompletar);
  const fa = textoFinal(asunto, false);
  if (!fa.ok) return fa;
  const fc = textoFinal(vc.cuerpo, true);
  if (!fc.ok) return fc;

  const contexto = await contextoDe(ctx.workspaceId, datos.entityType, datos.entityId, usuarioDe(ctx));
  if (!contexto) return no(MENSAJES_ENVIO.noEncontrado);
  const plantilla = await validarPlantilla(ctx.workspaceId, datos.templateId, "EMAIL", opciones.tipoPlantilla ?? datos.entityType, automatico);
  if (!plantilla.ok) return plantilla;
  const para = contexto.destino.email;
  if (!correoValido(para)) return no(MENSAJES_ENVIO.sinCorreo);

  const ahora = (deps.ahora ?? (() => new Date()))();
  if (automatico) {
    if ((await correosEnviadosHoy(ctx.workspaceId, ahora, true)) >= TOPE_AUTOMATICOS_DIA) {
      console.warn("[plantillas] tope de correos automáticos alcanzado", { codigo: "TOPE_AUTOMATICOS" });
      return no(MENSAJES_ENVIO.topeAutomaticos);
    }
  } else if ((await correosEnviadosHoy(ctx.workspaceId, ahora)) >= TOPE_CORREOS_DIA) {
    return no(MENSAJES_ENVIO.tope);
  }

  const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
  const resultado = await enviar({
    to: para,
    subject: fa.texto,
    html: cuerpoCorreoHtml(fc.texto, contexto.firma.html, fc.conFirma),
    text: cuerpoCorreoTexto(fc.texto, contexto.firma.texto, fc.conFirma),
    fromName: contexto.remitente.nombre,
    ...(correoValido(contexto.remitente.replyTo) ? { replyTo: contexto.remitente.replyTo } : {}),
  });

  const fallo = resultado.status === "SENT" ? null : resultado;
  let mensajeId: string | null = null;
  try {
    const registro = {
      workspaceId: ctx.workspaceId,
      channel: "EMAIL",
      entityType: datos.registrarEn?.entityType ?? datos.entityType,
      entityId: datos.registrarEn?.entityId ?? datos.entityId,
      templateId: plantilla.id,
      toAddress: para,
      subject: fa.texto,
      body: vc.cuerpo.split(CARACTER_MARCADOR).join(""),
      status: fallo ? "FAILED" : "SENT",
      automatic: automatico,
      providerId: resultado.status === "SENT" ? resultado.providerId : null,
      errorCode: fallo ? codigoDeError(fallo) : null,
      actorUserId: ctx.userId,
      actorLabel: automatico ? "Automático" : ctx.userLabel,
    };
    if (datos.registroId) {
      // Completa la reserva (la fecha queda la de la reserva: es la que vio el candado).
      const r = await prisma.fotofficeMessage.updateMany({
        where: { id: datos.registroId, workspaceId: ctx.workspaceId, errorCode: CODIGO_ENVIO_EN_CURSO },
        data: registro,
      });
      if (r.count === 1) mensajeId = datos.registroId;
    }
    if (mensajeId === null) mensajeId = (await prisma.fotofficeMessage.create({ data: registro, select: { id: true } })).id;
  } catch (e) {
    // Sólo el código: nunca la dirección ni el cuerpo.
    console.error("[plantillas] no se pudo registrar el mensaje", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
  }

  if (fallo) {
    console.warn("[plantillas] falló el envío de un correo", { codigo: codigoDeError(fallo) });
    return { ok: false, error: mensajeDeFalla(fallo), registrado: mensajeId !== null };
  }
  return { ok: true, mensajeId: mensajeId ?? "" };
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export type DatosWhatsapp = {
  entityType: TipoFichaMensaje;
  entityId: string;
  templateId?: string | null;
  cuerpo: unknown;
  /** La ficha donde queda el registro, si no es la del destinatario (como en `DatosCorreo`). */
  registrarEn?: { entityType: "PRESUPUESTO" | "PEDIDO"; entityId: string };
};

export type ResultadoWhatsapp = { ok: true; url: string; mensajeId: string } | Falla;

/**
 * Arma el enlace `wa.me` con el texto final para el teléfono de la persona y lo registra como
 * `OPENED_WHATSAPP`. La firma va sólo si el texto la pide con `[firma]`.
 */
export async function abrirWhatsapp(ctx: CtxEnvio, datos: DatosWhatsapp, opciones: OpcionesDeEnvio = {}): Promise<ResultadoWhatsapp> {
  if (!puedeEnContexto(ctx, "operar", opciones.modulo ?? moduloDeTipo(datos.entityType))) return no(MENSAJES_ENVIO.sinPermiso);
  const vc = validarCuerpo(datos.cuerpo, "WHATSAPP");
  if (!vc.ok) return vc;
  if (tieneMarcadorSinCompletar(vc.cuerpo)) return no(MENSAJES_ENVIO.marcadorSinCompletar);
  const fc = textoFinal(vc.cuerpo, true);
  if (!fc.ok) return fc;

  const contexto = await contextoDe(ctx.workspaceId, datos.entityType, datos.entityId, usuarioDe(ctx));
  if (!contexto) return no(MENSAJES_ENVIO.noEncontrado);
  const plantilla = await validarPlantilla(ctx.workspaceId, datos.templateId, "WHATSAPP", opciones.tipoPlantilla ?? datos.entityType, false);
  if (!plantilla.ok) return plantilla;
  const numero = normalizeWhatsappNumber(contexto.destino.telefono);
  if (!numero) return no(MENSAJES_ENVIO.sinWhatsapp);

  const texto = textoWhatsapp(fc.texto, contexto.firma.texto);
  if (texto.length > MAX_CUERPO.WHATSAPP) return no(cuerpoLargo("WHATSAPP"));
  const url = buildWhatsappUrl(numero, texto);
  if (!url) return no(MENSAJES_ENVIO.sinWhatsapp);

  let fila: { id: string };
  try {
    fila = await prisma.fotofficeMessage.create({
      data: {
        workspaceId: ctx.workspaceId,
        channel: "WHATSAPP",
        entityType: datos.registrarEn?.entityType ?? datos.entityType,
        entityId: datos.registrarEn?.entityId ?? datos.entityId,
        templateId: plantilla.id,
        toAddress: numero,
        subject: null,
        body: texto,
        status: "OPENED_WHATSAPP",
        automatic: false,
        actorUserId: ctx.userId,
        actorLabel: ctx.userLabel,
      },
      select: { id: true },
    });
  } catch (e) {
    // Sólo el código: nunca el número ni el texto.
    console.error("[plantillas] no se pudo registrar el WhatsApp", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return no(MENSAJES_ENVIO.falloRegistro);
  }
  return { ok: true, url, mensajeId: fila.id };
}
