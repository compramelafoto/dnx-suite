"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { alCambiarCita } from "@/lib/agenda/google/hook";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { MENSAJES_TURNOS } from "@/lib/turnos/constantes";
import { avisarTurno, enlaceDeGestion, type DatosCorreoTurno, type EventoTurno } from "@/lib/turnos/correos";
import { validarDatosDeReserva } from "@/lib/turnos/formulario";
import { cancelarTurno, reprogramarTurno, turnoPorToken, type TurnoDeGestion } from "@/lib/turnos/gestion";
import { ocupadoGoogleDeLaVentana } from "@/lib/turnos/horarios";
import { leerAjustesTurnos, negocioPorSlug, tipoPublicado, type TipoPublicado } from "@/lib/turnos/publico";
import { lugarDelTurno, reservarTurno } from "@/lib/turnos/reservar";

/**
 * Acciones públicas de los turnos: reservar, cancelar y reprogramar. No piden sesión: el turno se
 * identifica por el token del enlace que llega por correo. Los correos y el aviso a Google salen
 * después de responder (`after`).
 */

export type EstadoAccionTurno = { error: string | null };

const FRENO = { limit: 12, windowMs: 10 * 60 * 1000 };

async function frenado(): Promise<boolean> {
  try {
    const ip = clientIp(await headers());
    if (ip === "desconocido") return false;
    return !checkRateLimit({ key: `turnos:${ip}`, ...FRENO }).allowed;
  } catch {
    return false;
  }
}

function inicioValido(v: FormDataEntryValue | null): Date | null {
  if (typeof v !== "string" || v.length > 40) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function avisar(datos: DatosCorreoTurno, evento: EventoTurno, citaId: string | null, hostUserId: number | null): void {
  after(async () => {
    const ajustes = await leerAjustesTurnos(datos.workspaceId);
    await Promise.all([
      avisarTurno(datos, evento, ajustes, hostUserId, new Date()),
      citaId ? alCambiarCita(datos.workspaceId, citaId) : Promise.resolve(),
    ]);
  });
}

function datosDeCorreo(t: Pick<TurnoDeGestion, "workspaceId" | "id" | "contactName" | "contactEmail" | "contactPhone">, tipo: TipoPublicado, inicio: Date, mensaje: string | null, enlace: string | null): DatosCorreoTurno {
  return {
    workspaceId: t.workspaceId,
    turnoId: t.id,
    tipoNombre: tipo.name,
    modalidad: tipo.modality,
    lugar: lugarDelTurno(tipo, t.contactPhone ?? ""),
    inicio,
    fin: new Date(inicio.getTime() + tipo.durationMinutes * 60_000),
    contactName: t.contactName,
    contactEmail: t.contactEmail,
    contactPhone: t.contactPhone,
    mensaje,
    enlaceGestion: enlace,
  };
}

export async function reservarTurnoAction(_prev: EstadoAccionTurno, form: FormData): Promise<EstadoAccionTurno> {
  // Campo trampa: lo completan los robots, nunca una persona.
  if (String(form.get("sitio_web") ?? "") !== "") return { error: MENSAJES_TURNOS.falla };
  if (await frenado()) return { error: "Recibimos muchos pedidos seguidos desde tu conexión. Probá de nuevo en unos minutos." };

  const slug = String(form.get("workspaceSlug") ?? "");
  const negocio = await negocioPorSlug(slug);
  if (!negocio) return { error: MENSAJES_TURNOS.noDisponible };
  const tipo = await tipoPublicado(negocio.workspaceId, String(form.get("tipoId") ?? ""));
  if (!tipo) return { error: MENSAJES_TURNOS.noDisponible };
  const inicio = inicioValido(form.get("inicio"));
  if (!inicio) return { error: MENSAJES_TURNOS.horario };
  const v = validarDatosDeReserva({ nombre: form.get("nombre"), correo: form.get("correo"), telefono: form.get("telefono"), mensaje: form.get("mensaje") });
  if (!v.ok) return { error: v.error };

  const ahora = new Date();
  const ajustes = await leerAjustesTurnos(negocio.workspaceId);
  const google = await ocupadoGoogleDeLaVentana(negocio.workspaceId, ajustes, ahora);
  if (!google.ok) return { error: MENSAJES_TURNOS.sinAgenda };

  const r = await reservarTurno({ workspaceId: negocio.workspaceId, hostUserId: negocio.hostUserId, tipo, ajustes, inicio, datos: v.datos, ocupadoGoogle: google.ocupado, ahora });
  if (!r.ok) return { error: r.error };

  const enlace = enlaceDeGestion(negocio.slug, r.token);
  avisar(
    datosDeCorreo({ workspaceId: negocio.workspaceId, id: r.turnoId, contactName: v.datos.nombre, contactEmail: v.datos.correo, contactPhone: v.datos.telefono }, tipo, inicio, v.datos.mensaje, enlace),
    "CONFIRMADO",
    r.citaId,
    negocio.hostUserId,
  );
  redirect(`/w/${encodeURIComponent(negocio.slug)}/turnos/gestion/${r.token}?nuevo=1`);
}

async function turnoYTipo(form: FormData) {
  const token = String(form.get("token") ?? "");
  const turno = await turnoPorToken(token);
  if (!turno) return null;
  const tipo = await tipoPublicado(turno.workspaceId, turno.typeId);
  return { token, turno, tipo };
}

export async function cancelarTurnoAction(_prev: EstadoAccionTurno, form: FormData): Promise<EstadoAccionTurno> {
  const c = await turnoYTipo(form);
  if (!c) return { error: MENSAJES_TURNOS.noEncontrado };
  const ajustes = await leerAjustesTurnos(c.turno.workspaceId);
  const r = await cancelarTurno(c.turno, ajustes, new Date());
  if (!r.ok) return { error: r.error };
  if (c.tipo) avisar(datosDeCorreo(c.turno, c.tipo, c.turno.startAt, null, null), "CANCELADO", c.turno.citaId, c.turno.hostUserId);
  else if (c.turno.citaId) after(() => alCambiarCita(c.turno.workspaceId, c.turno.citaId as string));
  const slug = String(form.get("workspaceSlug") ?? "");
  redirect(`/w/${encodeURIComponent(slug)}/turnos/gestion/${c.token}?cancelado=1`);
}

export async function reprogramarTurnoAction(_prev: EstadoAccionTurno, form: FormData): Promise<EstadoAccionTurno> {
  if (await frenado()) return { error: "Recibimos muchos pedidos seguidos desde tu conexión. Probá de nuevo en unos minutos." };
  const c = await turnoYTipo(form);
  if (!c) return { error: MENSAJES_TURNOS.noEncontrado };
  if (!c.tipo) return { error: "Este tipo de turno ya no se ofrece. Escribinos y lo vemos." };
  const inicio = inicioValido(form.get("inicio"));
  if (!inicio) return { error: MENSAJES_TURNOS.horario };
  const ahora = new Date();
  const ajustes = await leerAjustesTurnos(c.turno.workspaceId);
  const google = await ocupadoGoogleDeLaVentana(c.turno.workspaceId, ajustes, ahora);
  if (!google.ok) return { error: MENSAJES_TURNOS.sinAgenda };
  const r = await reprogramarTurno(c.turno, c.tipo, ajustes, inicio, google.ocupado, ahora);
  if (!r.ok) return { error: r.error };
  const slug = String(form.get("workspaceSlug") ?? "");
  avisar(datosDeCorreo(c.turno, c.tipo, inicio, null, enlaceDeGestion(slug, c.token)), "REPROGRAMADO", c.turno.citaId, c.turno.hostUserId);
  redirect(`/w/${encodeURIComponent(slug)}/turnos/gestion/${c.token}?reprogramado=1`);
}
