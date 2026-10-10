"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { RSVP_LIMITS, isRsvpMode, openingHasTime, rsvpState } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { conPermiso } from "@/lib/equipo/permisos";
import { datosDeCambio } from "@/lib/equipo/registro";
import { frenarPorUsuario } from "@/lib/limite";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { avisarLugarLiberado, type MuestraDelCorreo } from "@/lib/correos/inauguracion";
import { promoverEnTx, type Promovida } from "./cupo";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La muestra no existe."] };
const ID = /^[A-Za-z0-9_-]{1,64}$/;

class Corte extends Error {}

/**
 * Configuración de la confirmación de asistencia (etapa 5, D13): si se piden confirmaciones, el
 * cupo, los acompañantes y la nota. Dueño, coorganización o super admin (`rsvp`). No toca
 * `editVersion` (no pisa la ficha) y deja el registro del último cambio.
 */
export async function guardarInauguracion(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const id = String(fd.get("id") ?? "");
  if (!ID.test(id)) return NO_EXISTE;
  if (!frenarPorUsuario("guardarInauguracion", usuario.id).allowed) return { ok: false, errores: ["Esperá unos minutos y volvé a guardar."] };
  const modo = String(fd.get("rsvpStatus") ?? "");
  const cupo = String(fd.get("rsvpCapacity") ?? "").trim();
  const acomp = String(fd.get("rsvpMaxCompanions") ?? "").trim();
  const nota = String(fd.get("openingNote") ?? "").trim();
  const errores: string[] = [];
  if (!isRsvpMode(modo)) errores.push("Elegí si se pide confirmación.");
  const capacidad = cupo === "" ? null : /^\d{1,4}$/.test(cupo) && Number(cupo) >= 1 && Number(cupo) <= RSVP_LIMITS.capacity ? Number(cupo) : Number.NaN;
  if (Number.isNaN(capacidad)) errores.push(`El cupo va de 1 a ${RSVP_LIMITS.capacity} personas, o vacío si no hay cupo.`);
  const maxAcomp = /^\d$/.test(acomp) && Number(acomp) <= RSVP_LIMITS.maxCompanions ? Number(acomp) : Number.NaN;
  if (Number.isNaN(maxAcomp)) errores.push(`Los acompañantes van de 0 a ${RSVP_LIMITS.maxCompanions}.`);
  if (nota.length > RSVP_LIMITS.note) errores.push(`La nota puede tener hasta ${RSVP_LIMITS.note} caracteres.`);
  if (errores.length) return { ok: false, errores };

  let r: { muestra: MuestraDelCorreo; promovidas: Promovida[] };
  try {
    r = await prisma.$transaction(async (tx) => {
      const a = await tx.culturalActivity.findFirst({
        where: conPermiso({ id, type: "MUESTRA" }, usuario, "rsvp"),
        select: {
          id: true, slug: true, title: true, reviewStatus: true, isVirtualOnly: true, isCancelled: true, openingAt: true, openingEndsAt: true,
          venueName: true, address: true, city: true,
        },
      });
      if (!a) throw new Corte("La muestra no existe.");
      // Bloquea la muestra: una confirmación que entra justo ahora espera a que se aplique el cupo nuevo.
      await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${id} FOR UPDATE`;
      if (modo === "OPEN") {
        if (!openingHasTime(a.openingAt)) throw new Corte("Para recibir confirmaciones, cargá la hora de la inauguración en la ficha.");
        if (rsvpState({ ...a, type: "MUESTRA", rsvpStatus: "OPEN" }, new Date()) === "UNAVAILABLE") {
          throw new Corte("Para recibir confirmaciones, la muestra tiene que estar publicada y ser presencial.");
        }
      }
      await tx.culturalActivity.update({
        where: { id },
        data: { rsvpStatus: modo, rsvpCapacity: capacidad, rsvpMaxCompanions: maxAcomp, openingNote: nota || null, ...datosDeCambio(usuario.id, "INAUGURACION") },
      });
      return { muestra: a, promovidas: await promoverEnTx(tx, id, capacidad) };
    });
  } catch (err) {
    if (err instanceof Corte) return { ok: false, errores: [err.message] };
    throw err;
  }
  // Se avisa después de la transacción: un correo que no sale no deshace el cambio.
  for (const p of r.promovidas) if (p.email) await avisarLugarLiberado({ email: p.email, nombre: p.name, muestra: r.muestra });
  revalidatePath(`/m/${r.muestra.slug}`, "layout");
  revalidatePath(`/panel/difusion/${id}/inauguracion`);
  return { ok: true, id };
}

const ACCIONES = ["cancel", "confirm", "waitlist"] as const;
type AccionAsistencia = (typeof ACCIONES)[number];
const NO_ESTA: ResultadoAccion = { ok: false, errores: ["No encontramos esa confirmación."] };

/**
 * Cambios del equipo sobre una confirmación (D16, D20): cancelar (y pasar a la siguiente de la
 * espera), confirmar a mano aunque se pase del cupo (el equipo conoce su sala) o pasar a espera.
 */
export async function cambiarAsistencia(rsvpId: string, accion: string): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (typeof rsvpId !== "string" || !ID.test(rsvpId) || !(ACCIONES as readonly string[]).includes(accion)) return NO_ESTA;
  if (!frenarPorUsuario("gestionarAsistencias", usuario.id).allowed) return { ok: false, errores: ["Esperá unos minutos y seguí."] };
  const k = await prisma.culturalActivityRsvp.findUnique({ where: { id: rsvpId }, select: { id: true, activityId: true, status: true } });
  if (!k) return NO_ESTA;
  const que = accion as AccionAsistencia;
  let r: { muestra: MuestraDelCorreo; promovidas: Promovida[] };
  try {
    r = await prisma.$transaction(async (tx) => {
      const a = await tx.culturalActivity.findFirst({
        where: conPermiso({ id: k.activityId, type: "MUESTRA" }, usuario, "rsvp"),
        select: { id: true, slug: true, title: true, rsvpCapacity: true, openingAt: true, openingEndsAt: true, venueName: true, address: true, city: true },
      });
      if (!a) throw new Corte("No encontramos esa confirmación.");
      await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${a.id} FOR UPDATE`;
      const ahora = new Date();
      const donde = { id: k.id, activityId: a.id };
      if (que === "cancel") {
        const { count } = await tx.culturalActivityRsvp.updateMany({ where: { ...donde, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", cancelledAt: ahora } });
        return { muestra: a, promovidas: count ? await promoverEnTx(tx, a.id, a.rsvpCapacity, ahora) : [] };
      }
      if (que === "confirm") {
        await tx.culturalActivityRsvp.updateMany({
          where: { ...donde, status: { not: "CONFIRMED" } },
          // La marca de "pasó de la espera" le recuerda al equipo avisarle a esa persona.
          data: { status: "CONFIRMED", cancelledAt: null, promotedAt: k.status === "WAITLIST" ? ahora : null },
        });
        return { muestra: a, promovidas: [] };
      }
      // A espera: no se promueve en el momento (volvería a pasar la misma persona).
      await tx.culturalActivityRsvp.updateMany({ where: { ...donde, status: { not: "WAITLIST" } }, data: { status: "WAITLIST", cancelledAt: null, promotedAt: null } });
      return { muestra: a, promovidas: [] };
    });
  } catch (err) {
    if (err instanceof Corte) return { ok: false, errores: [err.message] };
    throw err;
  }
  for (const p of r.promovidas) if (p.email) await avisarLugarLiberado({ email: p.email, nombre: p.name, muestra: r.muestra });
  revalidatePath(`/panel/difusion/${k.activityId}/inauguracion`);
  return { ok: true, id: k.id };
}

/** "Cerrar confirmaciones": la invitación queda visible, pero ya no se anota nadie. */
export async function cerrarConfirmaciones(activityId: string): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (typeof activityId !== "string" || !ID.test(activityId)) return NO_EXISTE;
  if (!frenarPorUsuario("guardarInauguracion", usuario.id).allowed) return { ok: false, errores: ["Esperá unos minutos y volvé a probar."] };
  const { count } = await prisma.culturalActivity.updateMany({
    where: conPermiso({ id: activityId, type: "MUESTRA" }, usuario, "rsvp"),
    data: { rsvpStatus: "CLOSED", ...datosDeCambio(usuario.id, "INAUGURACION") },
  });
  if (count === 0) return NO_EXISTE;
  revalidatePath(`/panel/difusion/${activityId}/inauguracion`);
  return { ok: true, id: activityId };
}
