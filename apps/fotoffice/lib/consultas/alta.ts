import "server-only";
import { Prisma, prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { notificarEvento } from "@/lib/circuitos/eventos";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { responderConsultaNueva } from "@/lib/plantillas/automaticos";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { numerarConsultaNueva } from "@/lib/service-leads/numero";
import { puedeSerResponsable, type DepsAjustes } from "./ajustes";
import { avisarConsultaNueva } from "./aviso";
import type { CtxConsultas } from "./catalogo";
import { categoriaActiva, categoriaParaEventType } from "./categorias";
import { contactoParaConsulta, MAX_NOMBRE_CONTACTO, type DatosContacto } from "./contacto";
import { diaDeCalendario, fechasSuperpuestas, type ConsultaSuperpuesta } from "./fechas";
import { asegurarCatalogosDelWorkspace } from "./semillas";

/**
 * El único camino para dar de alta una consulta (spec §4.2): el alta manual, la rápida del
 * tablero, el formulario público y la importación.
 *
 * En UNA transacción: el contacto (buscado o creado), la consulta vieja (`ServiceSalesLead`, que
 * siguen leyendo las pantallas existentes y CompraMeLaFoto), su `FotofficeConsulta` y los
 * participantes. Si algo de eso falla, no queda nada.
 *
 * Después, fuera de la transacción y cada paso aislado (si uno falla, la consulta queda igual y
 * los demás corren), en este orden:
 *   1. número (0.5);
 *   2. circuito (0.4): entra a la primera etapa del circuito predeterminado;
 *   3. aviso al equipo y tarea "Responder consulta" (salvo en la importación);
 *   4. respuesta automática a la persona (0.6), SÓLO desde el formulario web.
 *
 * Nunca loguea datos personales: sólo códigos.
 */

export const ORIGENES_DEL_ALTA = ["MANUAL", "RAPIDA", "WEB", "IMPORTACION"] as const;
export type OrigenDelAlta = (typeof ORIGENES_DEL_ALTA)[number];

/** Topes de largo de los textos de la consulta. */
export const MAX_TEXTO_CONSULTA = 200;
export const MAX_MENSAJE_CONSULTA = 4000;
export const MAX_INVITADOS = 100_000;
export const MAX_VALOR_ESTIMADO = 1_000_000_000_000;
export const MAX_PARTICIPANTES = 50;

export const MENSAJES_ALTA = {
  sinPermiso: "No tenés permiso para cargar consultas.",
  datosInvalidos: "Los datos no son válidos.",
  contacto: "Elegí un contacto o escribí el nombre del contacto nuevo.",
  contactoNoEncontrado: "No encontramos ese contacto.",
  categoria: "Elegí una categoría.",
  origen: "Elegí un origen válido.",
  referente: "No encontramos el contacto que la recomendó.",
  responsable: "El responsable tiene que ser alguien del equipo con permiso para gestionar Consultas.",
  texto: `Los textos pueden tener hasta ${MAX_TEXTO_CONSULTA} caracteres.`,
  mensaje: `El mensaje puede tener hasta ${MAX_MENSAJE_CONSULTA} caracteres.`,
  invitados: "La cantidad de invitados no es válida.",
  valor: "El valor estimado no es válido.",
  fecha: "La fecha no es válida.",
  participante: "Algún participante no es válido.",
  fallo: "No se pudo registrar la consulta.",
} as const;

export type DatosEvento = {
  /** Día y hora del evento. Sin `horaConocida`, sólo vale el día. */
  startsAt?: Date | null;
  horaConocida?: boolean;
  venue?: string | null;
  ceremonyVenue?: string | null;
  receptionVenue?: string | null;
  city?: string | null;
  guests?: number | null;
  partnerOneName?: string | null;
  partnerTwoName?: string | null;
};

export type DatosAlta = {
  /** Un contacto existente del workspace, o los datos para buscarlo o crearlo. */
  contacto: { clientId: string } | DatosContacto;
  /** Categoría activa del workspace. Sin ella se elige por `eventType` (formularios, importación). */
  categoriaId?: string | null;
  /** Tipo viejo. Si no viene, el de la categoría (o "OTRO_EVENTO"). */
  eventType?: string | null;
  eventSubtype?: string | null;
  /** Día del evento (medianoche UTC = fecha de calendario, como guarda el formulario público). */
  eventDate?: Date | null;
  eventLocation?: string | null;
  message?: string | null;
  metaJson?: Prisma.InputJsonValue | null;
  formId?: string | null;
  formSlug?: string | null;
  evento?: DatosEvento;
  origenId?: string | null;
  referenteClientId?: string | null;
  valorEstimado?: number | null;
  cierrePrevisto?: Date | null;
  responsableUserId?: number | null;
  participantes?: { clientId: string; roleId: string; note?: string | null }[];
};

export type AvisosDelAlta = { fechaSuperpuesta?: ConsultaSuperpuesta[]; posibleDuplicado?: boolean };
export type ResultadoAlta =
  | { ok: true; leadId: string; consultaId: string; clientId: string; avisos: AvisosDelAlta }
  | { ok: false; error: string };

export type DepsAlta = DepsAjustes;

/** Quien da de alta sin usuario: el formulario público y los procesos automáticos. */
export function altaDelSistema(workspaceId: string): CtxConsultas {
  return { workspaceId, userId: null, userLabel: "Sistema", role: null };
}

/** Error de validación con un mensaje para mostrar. Dentro de la transacción la deshace. */
class ErrorDeAlta extends Error {}

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[consultas] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/** Texto opcional: recortado, vacío = null; más largo que `max` = error. */
function textoOpcional(v: unknown, max: number, mensaje: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new ErrorDeAlta(MENSAJES_ALTA.datosInvalidos);
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) throw new ErrorDeAlta(mensaje);
  return t;
}

function fechaOpcional(v: unknown): Date | null {
  if (v === undefined || v === null) return null;
  if (!(v instanceof Date) || Number.isNaN(v.getTime())) throw new ErrorDeAlta(MENSAJES_ALTA.fecha);
  return v;
}

function idOpcional(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > 100) throw new ErrorDeAlta(MENSAJES_ALTA.datosInvalidos);
  return v;
}

/** Medianoche UTC del día de calendario: así guarda el formulario público el día del evento. */
function comoDiaDeCalendario(d: Date): Date {
  return new Date(`${diaDeCalendario(d)}T00:00:00.000Z`);
}

type Validado = {
  contacto: { clientId: string } | { nombre: string; email: string | null; telefono: string | null };
  categoriaId: string | null;
  eventType: string | null;
  eventSubtype: string | null;
  eventDate: Date | null;
  eventLocation: string | null;
  message: string | null;
  formId: string | null;
  formSlug: string | null;
  evento: {
    eventStartsAt: Date | null;
    eventTimeKnown: boolean;
    venue: string | null;
    ceremonyVenue: string | null;
    receptionVenue: string | null;
    city: string | null;
    guests: number | null;
    partnerOneName: string | null;
    partnerTwoName: string | null;
  };
  origenId: string | null;
  referenteClientId: string | null;
  valorEstimado: number | null;
  cierrePrevisto: Date | null;
  responsableUserId: number | null;
  participantes: { clientId: string; roleId: string; note: string | null }[];
};

function validar(datos: DatosAlta): Validado {
  if (!datos || typeof datos !== "object") throw new ErrorDeAlta(MENSAJES_ALTA.datosInvalidos);
  const T = MAX_TEXTO_CONSULTA;
  const tx = (v: unknown) => textoOpcional(v, T, MENSAJES_ALTA.texto);

  let contacto: Validado["contacto"];
  const c = datos.contacto as Record<string, unknown> | undefined;
  if (c && typeof c.clientId === "string" && c.clientId) {
    contacto = { clientId: idOpcional(c.clientId)! };
  } else {
    const nombre = typeof c?.nombre === "string" ? c.nombre.trim().replace(/\s+/g, " ") : "";
    if (!nombre || nombre.length > MAX_NOMBRE_CONTACTO) throw new ErrorDeAlta(MENSAJES_ALTA.contacto);
    contacto = { nombre, email: textoOpcional(c?.email, 254, MENSAJES_ALTA.texto), telefono: textoOpcional(c?.telefono, 40, MENSAJES_ALTA.texto) };
  }

  const ev = datos.evento ?? {};
  const startsAt = fechaOpcional(ev.startsAt);
  const guests = ev.guests ?? null;
  if (guests !== null && (!Number.isInteger(guests) || guests < 0 || guests > MAX_INVITADOS)) {
    throw new ErrorDeAlta(MENSAJES_ALTA.invitados);
  }
  const valor = datos.valorEstimado ?? null;
  if (valor !== null && (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || valor > MAX_VALOR_ESTIMADO)) {
    throw new ErrorDeAlta(MENSAJES_ALTA.valor);
  }
  const responsable = datos.responsableUserId ?? null;
  if (responsable !== null && (typeof responsable !== "number" || !Number.isSafeInteger(responsable))) {
    throw new ErrorDeAlta(MENSAJES_ALTA.responsable);
  }
  const participantes = datos.participantes ?? [];
  if (!Array.isArray(participantes) || participantes.length > MAX_PARTICIPANTES) throw new ErrorDeAlta(MENSAJES_ALTA.participante);
  const vistos = new Set<string>();
  const unicos: Validado["participantes"] = [];
  for (const p of participantes) {
    const clientId = idOpcional(p?.clientId);
    const roleId = idOpcional(p?.roleId);
    if (!clientId || !roleId) throw new ErrorDeAlta(MENSAJES_ALTA.participante);
    const clave = `${clientId}|${roleId}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    unicos.push({ clientId, roleId, note: tx(p.note) });
  }

  const venue = tx(ev.venue);
  const eventLocation = tx(datos.eventLocation);
  const eventDate = fechaOpcional(datos.eventDate);
  return {
    contacto,
    categoriaId: idOpcional(datos.categoriaId),
    eventType: tx(datos.eventType),
    eventSubtype: tx(datos.eventSubtype),
    // El día del evento se refleja en la consulta vieja: el que vino, o el día de `startsAt`.
    eventDate: eventDate ?? (startsAt ? comoDiaDeCalendario(startsAt) : null),
    eventLocation: eventLocation ?? venue ?? tx(ev.receptionVenue) ?? tx(ev.ceremonyVenue),
    message: textoOpcional(datos.message, MAX_MENSAJE_CONSULTA, MENSAJES_ALTA.mensaje),
    formId: idOpcional(datos.formId),
    formSlug: tx(datos.formSlug),
    evento: {
      eventStartsAt: startsAt ?? eventDate,
      eventTimeKnown: startsAt !== null && ev.horaConocida === true,
      // El lugar del formulario viejo (texto libre) queda como lugar del evento.
      venue: venue ?? eventLocation,
      ceremonyVenue: tx(ev.ceremonyVenue),
      receptionVenue: tx(ev.receptionVenue),
      city: tx(ev.city),
      guests,
      partnerOneName: tx(ev.partnerOneName),
      partnerTwoName: tx(ev.partnerTwoName),
    },
    origenId: idOpcional(datos.origenId),
    referenteClientId: idOpcional(datos.referenteClientId),
    valorEstimado: valor,
    cierrePrevisto: fechaOpcional(datos.cierrePrevisto),
    responsableUserId: responsable,
    participantes: unicos,
  };
}

/** Nombre visible de un cliente (para la columna `name` de la consulta vieja). */
function nombreDeCliente(c: { firstName: string | null; lastName: string | null; businessName: string | null }): string {
  return (c.businessName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Sin nombre").slice(0, MAX_NOMBRE_CONTACTO);
}

export async function altaDeConsulta(
  quien: CtxConsultas,
  datos: DatosAlta,
  opciones: { origenDelAlta: OrigenDelAlta },
  deps: DepsAlta = {},
): Promise<ResultadoAlta> {
  const origenDelAlta = opciones?.origenDelAlta;
  if (!(ORIGENES_DEL_ALTA as readonly string[]).includes(origenDelAlta)) return { ok: false, error: MENSAJES_ALTA.datosInvalidos };
  // Con usuario, "Gestionar" en Consultas. Sin usuario (formulario, procesos) es el sistema.
  if (quien.userId !== null && !puedeEnContexto(quien, "operar", SERVICE_LEADS_MODULE_KEY)) {
    return { ok: false, error: MENSAJES_ALTA.sinPermiso };
  }
  const { workspaceId } = quien;

  let v: Validado;
  try {
    v = validar(datos);
  } catch (e) {
    if (e instanceof ErrorDeAlta) return { ok: false, error: e.message };
    throw e;
  }
  // Fuera de la transacción: lee los niveles de main con el `prisma` global.
  if (v.responsableUserId !== null && !(await puedeSerResponsable(workspaceId, v.responsableUserId, deps))) {
    return { ok: false, error: MENSAJES_ALTA.responsable };
  }
  try {
    await asegurarCatalogosDelWorkspace(workspaceId);
  } catch (error) {
    // Si no se pudo sembrar, la categoría no aparece y el alta lo dice abajo.
    registrarFalla("asegurarCatalogos", error);
  }

  const actor = { userId: quien.userId, label: quien.userLabel };
  let creado: { leadId: string; consultaId: string; clientId: string; createdAt: Date; posibleDuplicado: boolean };
  try {
    creado = await prisma.$transaction(async (tx) => {
      let categoria = v.categoriaId
        ? await categoriaActiva(tx, workspaceId, v.categoriaId)
        : await categoriaParaEventType(tx, workspaceId, v.eventType);
      // El formulario público nunca pierde una consulta por la configuración: si no queda
      // ninguna categoría activa, usa la equivalente (o cualquiera) aunque esté archivada.
      if (!categoria && !v.categoriaId && origenDelAlta === "WEB") {
        categoria = await categoriaParaEventType(tx, workspaceId, v.eventType, { incluirArchivadas: true });
      }
      if (!categoria) throw new ErrorDeAlta(MENSAJES_ALTA.categoria);

      if (v.origenId) {
        const origen = await tx.fotofficeOrigen.findFirst({ where: { id: v.origenId, workspaceId, archivedAt: null }, select: { id: true } });
        if (!origen) throw new ErrorDeAlta(MENSAJES_ALTA.origen);
      }
      if (v.referenteClientId) {
        const ref = await tx.client.findFirst({ where: { id: v.referenteClientId, workspaceId }, select: { id: true } });
        if (!ref) throw new ErrorDeAlta(MENSAJES_ALTA.referente);
      }

      // El formulario que llega del navegador sólo vale si es de este workspace.
      const formId = v.formId
        ? (await tx.serviceLeadForm.findFirst({ where: { id: v.formId, workspaceId }, select: { id: true } }))?.id ?? null
        : null;

      // El contacto: uno existente del workspace, o buscado/creado. Desde la web, sólo por correo
      // (regla R3: el teléfono no se verifica).
      let clientId: string;
      let posibleDuplicado = false;
      let persona: { name: string; email: string | null; phone: string | null };
      if ("clientId" in v.contacto) {
        const c = await tx.client.findFirst({
          where: { id: v.contacto.clientId, workspaceId },
          select: { id: true, firstName: true, lastName: true, businessName: true, email: true, phone: true },
        });
        if (!c) throw new ErrorDeAlta(MENSAJES_ALTA.contactoNoEncontrado);
        clientId = c.id;
        persona = { name: nombreDeCliente(c), email: c.email, phone: c.phone };
      } else {
        const r = await contactoParaConsulta(tx, workspaceId, v.contacto, actor, {
          coincidir: origenDelAlta === "WEB" ? "correo" : "correo-o-telefono",
        });
        clientId = r.clientId;
        posibleDuplicado = r.posibleDuplicado;
        persona = { name: v.contacto.nombre, email: v.contacto.email, phone: v.contacto.telefono };
      }

      const lead = await tx.serviceSalesLead.create({
        data: {
          workspaceId,
          formId,
          formSlug: v.formSlug,
          name: persona.name,
          email: persona.email,
          phone: persona.phone,
          eventType: v.eventType ?? categoria.legacyEventType ?? "OTRO_EVENTO",
          eventSubtype: v.eventSubtype,
          eventDate: v.eventDate,
          eventLocation: v.eventLocation,
          message: v.message,
          metaJson: datos.metaJson ?? Prisma.JsonNull,
          status: "NEW",
        },
        select: { id: true, createdAt: true },
      });
      const consulta = await tx.fotofficeConsulta.create({
        data: {
          workspaceId,
          leadId: lead.id,
          clientId,
          categoryId: categoria.id,
          originId: v.origenId,
          referrerClientId: v.referenteClientId,
          estimatedValue: v.valorEstimado,
          expectedCloseDate: v.cierrePrevisto,
          ...v.evento,
        },
        select: { id: true },
      });

      if (v.participantes.length > 0) {
        const clientes = await tx.client.findMany({
          where: { workspaceId, id: { in: [...new Set(v.participantes.map((p) => p.clientId))] } },
          select: { id: true },
        });
        const roles = await tx.fotofficeRolParticipante.findMany({
          where: { workspaceId, archivedAt: null, id: { in: [...new Set(v.participantes.map((p) => p.roleId))] } },
          select: { id: true },
        });
        const okClientes = new Set(clientes.map((c) => c.id));
        const okRoles = new Set(roles.map((r) => r.id));
        if (!v.participantes.every((p) => okClientes.has(p.clientId) && okRoles.has(p.roleId))) {
          throw new ErrorDeAlta(MENSAJES_ALTA.participante);
        }
        await tx.fotofficeConsultaParticipante.createMany({
          data: v.participantes.map((p) => ({ workspaceId, consultaId: consulta.id, clientId: p.clientId, roleId: p.roleId, note: p.note })),
        });
      }
      return { leadId: lead.id, consultaId: consulta.id, clientId, createdAt: lead.createdAt, posibleDuplicado };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof ErrorDeAlta) return { ok: false, error: e.message };
    registrarFalla("altaDeConsulta", e);
    return { ok: false, error: MENSAJES_ALTA.fallo };
  }

  const { leadId } = creado;

  // 1. Número (no lanza: si falla, la numera el próximo enganche).
  try {
    await numerarConsultaNueva(workspaceId, leadId, creado.createdAt);
  } catch (error) {
    registrarFalla("numerarConsultaNueva", error);
  }

  // 2. Circuito: primera etapa del predeterminado y, si se eligió, su responsable.
  try {
    await notificarEvento(workspaceId, { tipo: "CAPTACION", id: leadId }, "CONSULTA_RECIBIDA", leadId);
    if (v.responsableUserId !== null) {
      await prisma.fotofficeJourney.updateMany({
        where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, kind: "VENTA", closedAt: null },
        data: { ownerUserId: v.responsableUserId },
      });
    }
  } catch (error) {
    registrarFalla("circuito", error);
  }

  // 3. Aviso al equipo y tarea (la importación de consultas viejas no avisa).
  if (origenDelAlta !== "IMPORTACION") {
    try {
      await avisarConsultaNueva(workspaceId, leadId, { responsableUserId: v.responsableUserId }, deps);
    } catch (error) {
      registrarFalla("avisarConsultaNueva", error);
    }
  }

  // 4. Respuesta automática a la persona: sólo desde el formulario web (spec §3.1 y §3.5).
  if (origenDelAlta === "WEB") {
    try {
      await responderConsultaNueva(workspaceId, leadId);
    } catch (error) {
      registrarFalla("responderConsultaNueva", error);
    }
  }

  const avisos: AvisosDelAlta = {};
  if (creado.posibleDuplicado) avisos.posibleDuplicado = true;
  if (v.eventDate) {
    try {
      const superpuestas = await fechasSuperpuestas(workspaceId, v.eventDate, leadId);
      if (superpuestas.length > 0) avisos.fechaSuperpuesta = superpuestas;
    } catch (error) {
      registrarFalla("fechasSuperpuestas", error);
    }
  }
  return { ok: true, leadId, consultaId: creado.consultaId, clientId: creado.clientId, avisos };
}
