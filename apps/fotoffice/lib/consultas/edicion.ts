import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { finDelDiaElegido, valoresDeVencimiento } from "@/lib/circuitos/ficha-vista";
import { asignarResponsable, cambiarVencimiento, OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { puedeSerResponsable, type DepsAjustes } from "./ajustes";
import {
  altaDeConsulta,
  MAX_INVITADOS,
  MAX_MENSAJE_CONSULTA,
  MAX_PARTICIPANTES,
  MAX_TEXTO_CONSULTA,
  MAX_VALOR_ESTIMADO,
  MENSAJES_ALTA,
  type DatosAlta,
  type DatosEvento,
  type OrigenDelAlta,
} from "./alta";
import type { CtxConsultas } from "./catalogo";
import { categoriaActiva } from "./categorias";
import { esGrupoConsulta, type CampoEvento } from "./constantes";
import { MAX_NOMBRE_CONTACTO } from "./contacto";
import { posiblesDuplicadosDe, type Opcion } from "./ficha";
import type { ConsultaSuperpuesta } from "./fechas";
import {
  diaDeFecha,
  eventoDelFormulario,
  fechaDeCalendario,
  numeroDeTexto,
  type CampoConError,
  type EventoConvertido,
  type FormEvento,
} from "./formulario";

/**
 * Altas y cambios de Consultas desde las pantallas del equipo (spec §3.1 y §3.2):
 *   - "Nueva consulta" (alta MANUAL) y el alta rápida del tablero (alta RAPIDA): las dos pasan
 *     por `altaDeConsulta`, el único camino del alta. Nunca hay respuesta automática al cliente;
 *   - la columna de datos de la ficha: categoría (con los datos de su grupo), origen, referente,
 *     valor, cierre previsto, responsable y siguiente acción;
 *   - los participantes: agregar y quitar.
 *
 * Todo exige "Gestionar" en Consultas, se mira ANTES de leer nada, y cada id que llega del
 * navegador se busca dentro del workspace de la sesión (contacto, categoría, origen, referente,
 * responsable, rol y participante).
 *
 * Elegir un contacto EXISTENTE (como contacto, referente o participante) exige además "Ver" en
 * Clientes (regla R10): si no, el buscador le abriría el padrón de clientes a un rol que no lo
 * tiene. Sin ese nivel sólo se carga "Contacto nuevo" (el alta igual lo empareja por correo o
 * teléfono, sin mostrar los datos del otro contacto).
 *
 * Los errores llevan `campo`: el dato del formulario que hay que corregir.
 */

export const MENSAJES_EDICION = {
  noEncontrada: "No encontramos esa consulta.",
  sinCircuito: "La consulta no está en un circuito abierto: el responsable y la siguiente acción se cambian desde ahí.",
  siguienteAccion: "Elegí una fecha válida para la siguiente acción.",
  contactoRapido: "Escribí un teléfono o un correo.",
  participanteRepetido: "Ese contacto ya está en la consulta con ese rol.",
  participanteNoEncontrado: "No encontramos ese participante.",
  topeParticipantes: `Una consulta puede tener hasta ${MAX_PARTICIPANTES} participantes.`,
  rol: "Elegí un rol válido.",
  sinContactos: "No tenés permiso para ver los contactos de Clientes: cargá un contacto nuevo.",
  fallo: "No se pudo guardar el cambio. Probá de nuevo.",
} as const;

export type FormContacto = { clientId: string } | { nombre: string; email?: string; telefono?: string };

export type FormNuevaConsulta = {
  contacto: FormContacto;
  categoriaId: string;
  evento?: FormEvento;
  origenId?: string | null;
  referenteClientId?: string | null;
  valor?: string;
  cierrePrevisto?: string;
  responsableUserId?: number | null;
  nota?: string;
};

export type FormAltaRapida = { nombre: string; telefonoOCorreo: string; categoriaId: string };

/**
 * `duplicados`: los otros contactos con el mismo correo o teléfono (sólo con "Ver" en Clientes).
 * `posibleDuplicado`: lo mismo, sin datos del otro contacto (sin "Ver" en Clientes).
 */
export type AvisosDeConsulta = { fechaSuperpuesta?: ConsultaSuperpuesta[]; duplicados?: Opcion[]; posibleDuplicado?: boolean };
export type Falla = { ok: false; error: string; campo?: CampoConError };
export type ResultadoCreacion = { ok: true; leadId: string; avisos: AvisosDeConsulta } | Falla;
export type Resultado = { ok: true } | Falla;

/** Error de validación con un mensaje para mostrar y el campo a corregir. Dentro de la transacción la deshace. */
class ErrorDeEdicion extends Error {
  constructor(
    mensaje: string,
    readonly campo?: CampoConError,
  ) {
    super(mensaje);
  }
}

/** El campo de cada mensaje que devuelve `altaDeConsulta` (que no sabe de formularios). */
const CAMPO_DE_MENSAJE_ALTA = new Map<string, CampoConError>([
  [MENSAJES_ALTA.contacto, "contacto"],
  [MENSAJES_ALTA.contactoNoEncontrado, "contacto"],
  [MENSAJES_ALTA.categoria, "categoria"],
  [MENSAJES_ALTA.origen, "origen"],
  [MENSAJES_ALTA.referente, "referente"],
  [MENSAJES_ALTA.referentePropio, "referente"],
  [MENSAJES_ALTA.responsable, "responsable"],
  [MENSAJES_ALTA.valor, "valor"],
  [MENSAJES_ALTA.invitados, "invitados"],
  [MENSAJES_ALTA.mensaje, "nota"],
]);

function falla(error: string, campo?: CampoConError): Falla {
  return campo ? { ok: false, error, campo } : { ok: false, error };
}

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[consultas] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function puedeGestionar(ctx: CtxConsultas): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", SERVICE_LEADS_MODULE_KEY);
}

/** ¿Puede elegir contactos existentes? "Ver" en Clientes (regla R10). */
export function veContactos(ctx: CtxConsultas): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
}

/** id opcional: vacío = null; con otra forma = error. */
function idOpcional(v: unknown, campo?: CampoConError): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > 100) throw new ErrorDeEdicion(MENSAJES_ALTA.datosInvalidos, campo);
  return v;
}

function textoOpcional(v: unknown, max: number, mensaje: string, campo?: CampoConError): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new ErrorDeEdicion(MENSAJES_ALTA.datosInvalidos, campo);
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) throw new ErrorDeEdicion(mensaje, campo);
  return t;
}

function valorEstimado(v: unknown): number | null {
  const n = numeroDeTexto(v);
  if (n === undefined || (n !== null && (n < 0 || n > MAX_VALOR_ESTIMADO))) throw new ErrorDeEdicion(MENSAJES_ALTA.valor, "valor");
  return n === null ? null : Math.round(n * 100) / 100;
}

function cierrePrevisto(v: unknown): Date | null {
  const d = fechaDeCalendario(v);
  if (d === undefined) throw new ErrorDeEdicion(MENSAJES_ALTA.fecha, "cierrePrevisto");
  return d;
}

function responsable(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0) throw new ErrorDeEdicion(MENSAJES_ALTA.responsable, "responsable");
  return v;
}

/** Los textos del evento → los datos del grupo. Los campos que el grupo no pide no se tocan. */
function evento(grupo: string, f: unknown): { evento: Partial<EventoConvertido>; campos: readonly CampoEvento[] } {
  const r = eventoDelFormulario(esGrupoConsulta(grupo) ? grupo : "EVENTO", esObjeto(f) ? (f as FormEvento) : {});
  if (!r.ok) throw new ErrorDeEdicion(r.error === "fecha" ? MENSAJES_ALTA.fecha : MENSAJES_ALTA.invitados, r.error);
  for (const k of ["partnerOneName", "partnerTwoName", "ceremonyVenue", "receptionVenue", "venue", "city"] as const) {
    const t = r.evento[k];
    if (typeof t === "string" && t.length > MAX_TEXTO_CONSULTA) throw new ErrorDeEdicion(MENSAJES_ALTA.texto, "evento");
  }
  if (r.evento.guests != null && r.evento.guests > MAX_INVITADOS) throw new ErrorDeEdicion(MENSAJES_ALTA.invitados, "invitados");
  return r;
}

function aDatosEvento(e: Partial<EventoConvertido>): DatosEvento {
  const d: DatosEvento = {};
  if (e.startsAt !== undefined) {
    d.startsAt = e.startsAt;
    d.horaConocida = e.horaConocida === true;
  }
  for (const k of ["guests", "partnerOneName", "partnerTwoName", "ceremonyVenue", "receptionVenue", "venue", "city"] as const) {
    if (e[k] !== undefined) (d as Record<string, unknown>)[k] = e[k];
  }
  return d;
}

/**
 * Después del alta: los otros contactos con el mismo correo o teléfono, para el cartel. Sin
 * "Ver" en Clientes, sólo el aviso, sin nombres ni enlaces (R10).
 */
async function avisosDe(
  r: { leadId: string; clientId: string; avisos: { fechaSuperpuesta?: ConsultaSuperpuesta[]; posibleDuplicado?: boolean } },
  workspaceId: string,
  conDatos: boolean,
) {
  const avisos: AvisosDeConsulta = {};
  if (r.avisos.fechaSuperpuesta?.length) avisos.fechaSuperpuesta = r.avisos.fechaSuperpuesta;
  let hay = r.avisos.posibleDuplicado === true;
  try {
    const c = await prisma.client.findFirst({ where: { id: r.clientId, workspaceId }, select: { id: true, email: true, phone: true } });
    if (c) {
      const duplicados = await posiblesDuplicadosDe(workspaceId, { id: c.id, email: c.email, telefono: c.phone });
      if (duplicados.length > 0) {
        hay = true;
        if (conDatos) avisos.duplicados = duplicados;
      }
    }
  } catch (error) {
    registrarFalla("posiblesDuplicados", error);
  }
  if (hay && !avisos.duplicados) avisos.posibleDuplicado = true;
  return avisos;
}

async function crear(ctx: CtxConsultas, datos: DatosAlta, origenDelAlta: OrigenDelAlta, deps: DepsAjustes): Promise<ResultadoCreacion> {
  const r = await altaDeConsulta(ctx, datos, { origenDelAlta }, deps);
  if (!r.ok) return falla(r.error, CAMPO_DE_MENSAJE_ALTA.get(r.error));
  return { ok: true, leadId: r.leadId, avisos: await avisosDe(r, ctx.workspaceId, veContactos(ctx)) };
}

function contactoDelFormulario(c: unknown): DatosAlta["contacto"] {
  if (!esObjeto(c)) throw new ErrorDeEdicion(MENSAJES_ALTA.contacto, "contacto");
  if (typeof c.clientId === "string" && c.clientId) {
    if (c.clientId.length > 100) throw new ErrorDeEdicion(MENSAJES_ALTA.datosInvalidos, "contacto");
    return { clientId: c.clientId };
  }
  const nombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
  if (!nombre || nombre.length > MAX_NOMBRE_CONTACTO) throw new ErrorDeEdicion(MENSAJES_ALTA.contacto, "nombre");
  return {
    nombre,
    email: textoOpcional(c.email, 254, MENSAJES_ALTA.texto, "email"),
    telefono: textoOpcional(c.telefono, 40, MENSAJES_ALTA.texto, "telefono"),
  };
}

function fallaDe(e: unknown, donde: string, mensajeFallo: string): Falla {
  if (e instanceof ErrorDeEdicion) return falla(e.message, e.campo);
  registrarFalla(donde, e);
  return falla(mensajeFallo);
}

/** "Nueva consulta" (spec §3.1): alta MANUAL, sin respuesta automática al cliente. */
export async function crearConsultaManual(ctx: CtxConsultas, form: FormNuevaConsulta, deps: DepsAjustes = {}): Promise<ResultadoCreacion> {
  if (!puedeGestionar(ctx)) return { ok: false, error: MENSAJES_ALTA.sinPermiso };
  try {
    if (!esObjeto(form)) throw new ErrorDeEdicion(MENSAJES_ALTA.datosInvalidos);
    const contacto = contactoDelFormulario(form.contacto);
    const categoriaId = idOpcional(form.categoriaId, "categoria");
    if (!categoriaId) throw new ErrorDeEdicion(MENSAJES_ALTA.categoria, "categoria");
    const referenteClientId = idOpcional(form.referenteClientId, "referente");
    // Un contacto existente (o un referente) sólo con "Ver" en Clientes (R10).
    if ("clientId" in contacto && !veContactos(ctx)) throw new ErrorDeEdicion(MENSAJES_EDICION.sinContactos, "contacto");
    if (referenteClientId && !veContactos(ctx)) throw new ErrorDeEdicion(MENSAJES_EDICION.sinContactos, "referente");
    const datos: DatosAlta = {
      contacto,
      categoriaId,
      origenId: idOpcional(form.origenId, "origen"),
      referenteClientId,
      valorEstimado: valorEstimado(form.valor),
      cierrePrevisto: cierrePrevisto(form.cierrePrevisto),
      responsableUserId: responsable(form.responsableUserId),
      message: textoOpcional(form.nota, MAX_MENSAJE_CONSULTA, MENSAJES_ALTA.mensaje, "nota"),
    };
    // El grupo de la categoría decide qué datos del evento se guardan. Si no es una activa del
    // workspace, el alta lo rechaza con su propio mensaje.
    const categoria = await categoriaActiva(prisma, ctx.workspaceId, categoriaId);
    if (!categoria) throw new ErrorDeEdicion(MENSAJES_ALTA.categoria, "categoria");
    datos.evento = aDatosEvento(evento(categoria.group, form.evento).evento);
    return await crear(ctx, datos, "MANUAL", deps);
  } catch (e) {
    return fallaDe(e, "crearConsultaManual", MENSAJES_ALTA.fallo);
  }
}

/** Alta rápida del tablero (spec §3.1): nombre, teléfono o correo, y categoría. */
export async function crearConsultaRapida(ctx: CtxConsultas, form: FormAltaRapida, deps: DepsAjustes = {}): Promise<ResultadoCreacion> {
  if (!puedeGestionar(ctx)) return { ok: false, error: MENSAJES_ALTA.sinPermiso };
  try {
    if (!esObjeto(form)) throw new ErrorDeEdicion(MENSAJES_ALTA.datosInvalidos);
    const nombre = typeof form.nombre === "string" ? form.nombre.trim() : "";
    if (!nombre || nombre.length > MAX_NOMBRE_CONTACTO) throw new ErrorDeEdicion(MENSAJES_ALTA.contacto, "nombre");
    const dato = textoOpcional(form.telefonoOCorreo, 254, MENSAJES_ALTA.texto, "telefonoOCorreo");
    if (!dato) throw new ErrorDeEdicion(MENSAJES_EDICION.contactoRapido, "telefonoOCorreo");
    const esCorreo = dato.includes("@");
    if (!esCorreo && dato.length > 40) throw new ErrorDeEdicion(MENSAJES_ALTA.texto, "telefonoOCorreo");
    const categoriaId = idOpcional(form.categoriaId, "categoria");
    if (!categoriaId) throw new ErrorDeEdicion(MENSAJES_ALTA.categoria, "categoria");
    return await crear(
      ctx,
      { contacto: esCorreo ? { nombre, email: dato } : { nombre, telefono: dato }, categoriaId },
      "RAPIDA",
      deps,
    );
  } catch (e) {
    return fallaDe(e, "crearConsultaRapida", MENSAJES_ALTA.fallo);
  }
}

export type FormEdicion = {
  categoriaId: string;
  evento?: FormEvento;
  origenId?: string | null;
  referenteClientId?: string | null;
  valor?: string;
  cierrePrevisto?: string;
  /** undefined = no se toca. */
  responsableUserId?: number | null;
  /** "aaaa-mm-dd"; "" o null = sin siguiente acción; undefined = no se toca. */
  siguienteAccion?: string | null;
};

/** Lugar que se refleja en la consulta vieja (`eventLocation`), como en el alta. */
function lugarVisible(e: { venue: string | null; receptionVenue: string | null; ceremonyVenue: string | null }): string | null {
  return e.venue ?? e.receptionVenue ?? e.ceremonyVenue ?? null;
}

/**
 * Guarda la columna de datos de la ficha. La consulta, su categoría, origen y referente se
 * guardan juntos (si algo no vale, nada cambia). Después, el responsable y la siguiente acción
 * van por el motor de etapas: la siguiente acción es `FotofficeJourney.stageDueAt` y su cambio
 * queda en el historial ("Vencimiento cambiado a …"), como cualquier otro cambio del recorrido.
 */
export async function editarConsulta(ctx: CtxConsultas, leadId: unknown, form: FormEdicion, deps: DepsAjustes = {}): Promise<Resultado> {
  if (!puedeGestionar(ctx)) return { ok: false, error: MENSAJES_ALTA.sinPermiso };
  const { workspaceId } = ctx;
  try {
    if (typeof leadId !== "string" || !leadId || leadId.length > 100 || !esObjeto(form)) {
      throw new ErrorDeEdicion(MENSAJES_ALTA.datosInvalidos);
    }
    const categoriaId = idOpcional(form.categoriaId, "categoria");
    if (!categoriaId) throw new ErrorDeEdicion(MENSAJES_ALTA.categoria, "categoria");
    const origenId = idOpcional(form.origenId, "origen");
    const referenteId = idOpcional(form.referenteClientId, "referente");
    const valor = valorEstimado(form.valor);
    const cierre = cierrePrevisto(form.cierrePrevisto);
    const nuevoResponsable = form.responsableUserId === undefined ? undefined : responsable(form.responsableUserId);
    let siguiente: Date | null | undefined;
    if (form.siguienteAccion === undefined) siguiente = undefined;
    else if (form.siguienteAccion === null || form.siguienteAccion === "") siguiente = null;
    else if (typeof form.siguienteAccion === "string") {
      siguiente = finDelDiaElegido(form.siguienteAccion.trim());
      if (!siguiente) throw new ErrorDeEdicion(MENSAJES_EDICION.siguienteAccion, "siguienteAccion");
    } else throw new ErrorDeEdicion(MENSAJES_EDICION.siguienteAccion, "siguienteAccion");

    const actual = await prisma.fotofficeConsulta.findFirst({
      where: { leadId, workspaceId },
      select: { id: true, clientId: true, categoryId: true, originId: true, referrerClientId: true },
    });
    if (!actual) throw new ErrorDeEdicion(MENSAJES_EDICION.noEncontrada);
    // Nadie se recomienda a sí mismo; elegir otro referente es elegir un contacto existente (R10).
    if (referenteId && referenteId === actual.clientId) throw new ErrorDeEdicion(MENSAJES_ALTA.referentePropio, "referente");
    if (referenteId && referenteId !== actual.referrerClientId && !veContactos(ctx)) {
      throw new ErrorDeEdicion(MENSAJES_EDICION.sinContactos, "referente");
    }

    // El recorrido abierto, sólo si hay algo que cambiar en él.
    let recorrido: { id: string; ownerUserId: number | null; stageDueAt: Date | null } | null = null;
    if (nuevoResponsable !== undefined || siguiente !== undefined) {
      recorrido = await prisma.fotofficeJourney.findFirst({
        where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, closedAt: null },
        select: { id: true, ownerUserId: true, stageDueAt: true },
      });
    }
    const cambiaResponsable = nuevoResponsable !== undefined && nuevoResponsable !== (recorrido?.ownerUserId ?? null);
    const cambiaSiguiente =
      siguiente !== undefined &&
      valoresDeVencimiento(siguiente ? siguiente.toISOString() : null).fecha !==
        valoresDeVencimiento(recorrido?.stageDueAt ? recorrido.stageDueAt.toISOString() : null).fecha;
    if ((cambiaResponsable || cambiaSiguiente) && !recorrido) {
      throw new ErrorDeEdicion(MENSAJES_EDICION.sinCircuito, cambiaResponsable ? "responsable" : "siguienteAccion");
    }
    if (cambiaResponsable && nuevoResponsable !== null && !(await puedeSerResponsable(workspaceId, nuevoResponsable, deps))) {
      throw new ErrorDeEdicion(MENSAJES_ALTA.responsable, "responsable");
    }

    await prisma.$transaction(async (tx) => {
      // La categoría actual vale aunque esté archivada (las consultas viejas la siguen mostrando);
      // una nueva tiene que ser activa y del workspace.
      const categoria =
        categoriaId === actual.categoryId
          ? await tx.fotofficeConsultaCategoria.findFirst({
              where: { id: categoriaId, workspaceId },
              select: { id: true, group: true, legacyEventType: true },
            })
          : await categoriaActiva(tx, workspaceId, categoriaId);
      if (!categoria) throw new ErrorDeEdicion(MENSAJES_ALTA.categoria, "categoria");
      if (origenId && origenId !== actual.originId) {
        const o = await tx.fotofficeOrigen.findFirst({ where: { id: origenId, workspaceId, archivedAt: null }, select: { id: true } });
        if (!o) throw new ErrorDeEdicion(MENSAJES_ALTA.origen, "origen");
      }
      if (referenteId) {
        const ref = await tx.client.findFirst({ where: { id: referenteId, workspaceId }, select: { id: true } });
        if (!ref) throw new ErrorDeEdicion(MENSAJES_ALTA.referente, "referente");
      }
      const { evento: ev, campos } = evento(categoria.group, form.evento);
      const datosEvento: Record<string, unknown> = {};
      if (ev.startsAt !== undefined) {
        datosEvento.eventStartsAt = ev.startsAt;
        datosEvento.eventTimeKnown = ev.startsAt !== null && ev.horaConocida === true;
      }
      for (const k of ["guests", "partnerOneName", "partnerTwoName", "ceremonyVenue", "receptionVenue", "venue", "city"] as const) {
        if (ev[k] !== undefined) datosEvento[k] = ev[k];
      }
      const n = await tx.fotofficeConsulta.updateMany({
        where: { id: actual.id, workspaceId },
        data: {
          categoryId: categoria.id,
          originId: origenId,
          referrerClientId: referenteId,
          estimatedValue: valor,
          expectedCloseDate: cierre,
          ...datosEvento,
        },
      });
      if (n.count !== 1) throw new ErrorDeEdicion(MENSAJES_EDICION.noEncontrada);

      // Lo que leen las pantallas viejas y CompraMeLaFoto: tipo, día y lugar del evento.
      const lead: Record<string, unknown> = {};
      if (categoria.id !== actual.categoryId) lead.eventType = categoria.legacyEventType ?? "OTRO_EVENTO";
      if (campos.includes("fechaHora")) {
        lead.eventDate = ev.startsAt ? new Date(`${diaDeFecha(ev.startsAt)}T00:00:00.000Z`) : null;
      }
      if (campos.some((c) => c === "lugar" || c === "recepcion" || c === "ceremonia")) {
        const guardada = await tx.fotofficeConsulta.findFirst({
          where: { id: actual.id, workspaceId },
          select: { venue: true, receptionVenue: true, ceremonyVenue: true },
        });
        if (guardada) lead.eventLocation = lugarVisible(guardada);
      }
      if (Object.keys(lead).length > 0) {
        await tx.serviceSalesLead.updateMany({ where: { id: leadId, workspaceId }, data: lead });
      }
    }, OPCIONES_TRANSACCION);

    if (recorrido && cambiaResponsable) {
      const r = await asignarResponsable(ctx, recorrido.id, nuevoResponsable ?? null);
      if (!r.ok) return falla(r.error, "responsable");
    }
    if (recorrido && cambiaSiguiente) {
      const r = await cambiarVencimiento(ctx, recorrido.id, siguiente ?? null, "");
      if (!r.ok) return falla(r.error, "siguienteAccion");
    }
    return { ok: true };
  } catch (e) {
    return fallaDe(e, "editarConsulta", MENSAJES_EDICION.fallo);
  }
}

/** La `FotofficeConsulta` de una consulta del workspace (null si no existe o es ajena). */
async function consultaDe(workspaceId: string, leadId: unknown): Promise<{ id: string } | null> {
  if (typeof leadId !== "string" || !leadId || leadId.length > 100) return null;
  return prisma.fotofficeConsulta.findFirst({ where: { leadId, workspaceId }, select: { id: true } });
}

/** Agrega un participante: un contacto del workspace con un rol activo del workspace y una nota. */
export async function agregarParticipante(
  ctx: CtxConsultas,
  leadId: unknown,
  datos: { clientId: unknown; roleId: unknown; nota?: unknown },
): Promise<Resultado> {
  if (!puedeGestionar(ctx)) return { ok: false, error: MENSAJES_ALTA.sinPermiso };
  const { workspaceId } = ctx;
  try {
    // Cada participante es un contacto existente: "Ver" en Clientes (R10).
    if (!veContactos(ctx)) throw new ErrorDeEdicion(MENSAJES_EDICION.sinContactos, "participanteContacto");
    if (!esObjeto(datos)) throw new ErrorDeEdicion(MENSAJES_ALTA.datosInvalidos);
    const clientId = idOpcional(datos.clientId, "participanteContacto");
    const roleId = idOpcional(datos.roleId, "rol");
    if (!clientId) throw new ErrorDeEdicion(MENSAJES_ALTA.contactoNoEncontrado, "participanteContacto");
    if (!roleId) throw new ErrorDeEdicion(MENSAJES_EDICION.rol, "rol");
    const nota = textoOpcional(datos.nota, MAX_TEXTO_CONSULTA, MENSAJES_ALTA.texto, "participanteNota");
    const consulta = await consultaDe(workspaceId, leadId);
    if (!consulta) throw new ErrorDeEdicion(MENSAJES_EDICION.noEncontrada);
    const [cliente, rol, cuantos] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true } }),
      prisma.fotofficeRolParticipante.findFirst({ where: { id: roleId, workspaceId, archivedAt: null }, select: { id: true } }),
      prisma.fotofficeConsultaParticipante.count({ where: { consultaId: consulta.id, workspaceId } }),
    ]);
    if (!cliente) throw new ErrorDeEdicion(MENSAJES_ALTA.contactoNoEncontrado, "participanteContacto");
    if (!rol) throw new ErrorDeEdicion(MENSAJES_EDICION.rol, "rol");
    if (cuantos >= MAX_PARTICIPANTES) throw new ErrorDeEdicion(MENSAJES_EDICION.topeParticipantes);
    try {
      await prisma.fotofficeConsultaParticipante.create({
        data: { workspaceId, consultaId: consulta.id, clientId: cliente.id, roleId: rol.id, note: nota },
        select: { id: true },
      });
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code === "P2002") throw new ErrorDeEdicion(MENSAJES_EDICION.participanteRepetido);
      throw e;
    }
    return { ok: true };
  } catch (e) {
    return fallaDe(e, "agregarParticipante", MENSAJES_EDICION.fallo);
  }
}

/** Quita un participante de la consulta (sólo si es de esa consulta y del workspace). */
export async function quitarParticipante(ctx: CtxConsultas, leadId: unknown, participanteId: unknown): Promise<Resultado> {
  if (!puedeGestionar(ctx)) return { ok: false, error: MENSAJES_ALTA.sinPermiso };
  const { workspaceId } = ctx;
  try {
    const id = idOpcional(participanteId);
    if (!id) throw new ErrorDeEdicion(MENSAJES_EDICION.participanteNoEncontrado);
    const consulta = await consultaDe(workspaceId, leadId);
    if (!consulta) throw new ErrorDeEdicion(MENSAJES_EDICION.noEncontrada);
    const r = await prisma.fotofficeConsultaParticipante.deleteMany({ where: { id, consultaId: consulta.id, workspaceId } });
    if (r.count === 0) throw new ErrorDeEdicion(MENSAJES_EDICION.participanteNoEncontrado);
    return { ok: true };
  } catch (e) {
    return fallaDe(e, "quitarParticipante", MENSAJES_EDICION.fallo);
  }
}
