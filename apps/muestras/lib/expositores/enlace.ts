"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import {
  EXHIBITOR_LIMITS, EXHIBITOR_TEXT_LIMITS, dayEndAr, parseVisibility, temporalStatus, toArDay,
} from "@repo/muestras";
import { nuevoTokenDeInvitacion } from "@/lib/curaduria/token";
import { puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { datosDeCambio } from "@/lib/equipo/registro";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { modoDeGaleriaDe, visibilidadDesdeFormData } from "@/lib/visibilidad/mapear";

export type ResultadoEnlace = { ok: true; aviso?: string } | { ok: false; errores: string[] };

const SIN_SESION: ResultadoEnlace = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoEnlace = { ok: false, errores: ["No encontramos esa muestra entre las tuyas."] };
const SIN_ENLACE: ResultadoEnlace = { ok: false, errores: ["Primero generá el enlace."] };
const error = (texto: string): ResultadoEnlace => ({ ok: false, errores: [texto] });

const SELECCION = {
  id: true, slug: true, type: true, reviewStatus: true, isCancelled: true, startsAt: true, endsAt: true, galleryMode: true, visibility: true,
  exhibitorLink: { select: { id: true, status: true } },
} as const;
type Muestra = Prisma.CulturalActivityGetPayload<{ select: typeof SELECCION }>;

type Preparado = { listo: false; error: ResultadoEnlace } | { listo: true; usuario: Usuario; a: Muestra };

/**
 * Sesión, permiso `exhibitors` leído en la base (dueño, coorganización o super admin; el rol de
 * textos no), freno y la muestra. Sólo muestras (spec D10, D11).
 */
async function preparar(activityId: unknown): Promise<Preparado> {
  const usuario = await getUsuario();
  if (!usuario) return { listo: false, error: SIN_SESION };
  if (typeof activityId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(activityId)) return { listo: false, error: NO_EXISTE };
  const rol = await rolEnMuestra(activityId, usuario);
  if (!rol || !puede(usuario, "exhibitors", rol.role)) return { listo: false, error: NO_EXISTE };
  if (!frenarPorUsuario("enlaceExpositores", usuario.id).allowed) {
    return { listo: false, error: error("Hiciste muchos cambios seguidos. Esperá unos minutos.") };
  }
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: SELECCION });
  if (!a || a.type !== "MUESTRA") return { listo: false, error: NO_EXISTE };
  return { listo: true, usuario, a };
}

/** El enlace recibe expositores mientras la muestra no esté cancelada ni cerrada (spec D10). */
function noRecibe(a: Muestra, ahora: Date): ResultadoEnlace | null {
  if (a.isCancelled) return error("La muestra está cancelada.");
  if (temporalStatus(a, ahora) === "CLOSED") return error("La muestra ya cerró: no recibe expositores.");
  return null;
}

/** Un tope optativo: vacío (o "sin tope") = `null`; si hay, entero dentro del rango. */
function tope(raw: FormDataEntryValue | null, [min, max]: readonly [number, number], mensaje: string): { ok: true; valor: number | null } | { ok: false; error: string } {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: true, valor: null };
  if (!/^\d{1,6}$/.test(s)) return { ok: false, error: mensaje };
  const n = Number(s);
  return n >= min && n <= max ? { ok: true, valor: n } : { ok: false, error: mensaje };
}
const MENSAJE_OBRAS = `Las obras por expositor van de ${EXHIBITOR_LIMITS.worksPerExhibitor[0]} a ${EXHIBITOR_LIMITS.worksPerExhibitor[1]}.`;
const MENSAJE_EXPOSITORES = `La cantidad de expositores va de ${EXHIBITOR_LIMITS.exhibitors[0]} a ${EXHIBITOR_LIMITS.exhibitors[1]}.`;

const esChoqueUnico = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

function refrescar(id: string) {
  revalidatePath(`/panel/muestras/${id}`, "layout");
}

/**
 * Genera el enlace de expositores (spec D1, D24). Si la muestra todavía no tiene ajuste de sorpresa,
 * quien organiza **tiene que elegir** qué se ve online en el mismo paso (con "Adelanto" sugerido):
 * no hay un ajuste impuesto. Si el enlace ya existe, no hace nada.
 */
export async function crearEnlaceExpositores(fd: FormData): Promise<ResultadoEnlace> {
  const r = await preparar(fd.get("activityId"));
  if (!r.listo) return r.error;
  const { a, usuario } = r;
  if (a.exhibitorLink) return { ok: true };
  const cerrado = noRecibe(a, new Date());
  if (cerrado) return cerrado;
  const sinTope = fd.get("sinTope") === "1" || fd.get("sinTope") === "on";
  const obras = sinTope ? { ok: true as const, valor: null } : tope(fd.get("maxWorksPerExhibitor"), EXHIBITOR_LIMITS.worksPerExhibitor, MENSAJE_OBRAS);
  if (!obras.ok) return error(obras.error);

  let visibilidad: Prisma.CulturalActivityUpdateInput | null = null;
  if (a.visibility == null) {
    if (fd.get("visibilidadConfirmada") !== "1") return error("Elegí qué se ve online antes de generar el enlace.");
    const base = parseVisibility(null, a.galleryMode);
    const v = visibilidadDesdeFormData(fd, { ...base, online: { ...base.online, seed: randomBytes(12).toString("base64url") } });
    visibilidad = { visibility: v as unknown as Prisma.InputJsonValue, galleryMode: modoDeGaleriaDe(v), ...datosDeCambio(usuario.id, "FICHA") };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (visibilidad) await tx.culturalActivity.update({ where: { id: a.id }, data: visibilidad });
      // El token se guarda tal cual (spec D1): no da permisos sobre la muestra y hay que copiarlo muchas veces.
      await tx.culturalExhibitorLink.create({
        data: { activityId: a.id, token: nuevoTokenDeInvitacion().token, status: "OPEN", maxWorksPerExhibitor: obras.valor, createdByUserId: usuario.id },
      });
    });
  } catch (err) {
    // Dos pestañas generando a la vez: el índice único deja uno solo.
    if (esChoqueUnico(err)) return { ok: true };
    throw err;
  }
  refrescar(a.id);
  if (visibilidad) {
    revalidatePath(`/m/${a.slug}`, "layout");
    revalidatePath("/fotografos", "layout");
  }
  return { ok: true };
}

/** Topes optativos, fecha límite e instrucciones del enlace. */
export async function guardarEnlaceExpositores(fd: FormData): Promise<ResultadoEnlace> {
  const r = await preparar(fd.get("activityId"));
  if (!r.listo) return r.error;
  const { a } = r;
  if (!a.exhibitorLink) return SIN_ENLACE;
  const obras = tope(fd.get("maxWorksPerExhibitor"), EXHIBITOR_LIMITS.worksPerExhibitor, MENSAJE_OBRAS);
  const expositores = tope(fd.get("maxExhibitors"), EXHIBITOR_LIMITS.exhibitors, MENSAJE_EXPOSITORES);
  const errores = [obras, expositores].flatMap((t) => (t.ok ? [] : [t.error]));
  const dia = typeof fd.get("closesDay") === "string" ? String(fd.get("closesDay")).trim() : "";
  let closesAt: Date | null = null;
  if (dia) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(dayEndAr(dia).getTime())) errores.push("Revisá la fecha límite.");
    else if (dia < toArDay(new Date())) errores.push("La fecha límite no puede ser antes de hoy.");
    else if (dia > toArDay(a.endsAt)) errores.push("La fecha límite tiene que ser antes de que cierre la muestra.");
    else closesAt = dayEndAr(dia);
  }
  const instrucciones = typeof fd.get("instructions") === "string" ? String(fd.get("instructions")).trim() : "";
  if (instrucciones.length > EXHIBITOR_TEXT_LIMITS.instructions) {
    errores.push(`Las instrucciones pueden tener hasta ${EXHIBITOR_TEXT_LIMITS.instructions} caracteres.`);
  }
  if (errores.length || !obras.ok || !expositores.ok) return { ok: false, errores };
  await prisma.culturalExhibitorLink.update({
    where: { activityId: a.id },
    data: { maxWorksPerExhibitor: obras.valor, maxExhibitors: expositores.valor, closesAt, instructions: instrucciones || null },
  });
  refrescar(a.id);
  return { ok: true };
}

/** "Generar un enlace nuevo": el anterior deja de andar (spec D1). */
export async function renovarEnlaceExpositores(activityId: string): Promise<ResultadoEnlace> {
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  if (!r.a.exhibitorLink) return SIN_ENLACE;
  const cerrado = noRecibe(r.a, new Date());
  if (cerrado) return cerrado;
  await prisma.culturalExhibitorLink.update({
    where: { activityId: r.a.id },
    data: { token: nuevoTokenDeInvitacion().token, rotatedAt: new Date() },
  });
  refrescar(r.a.id);
  return { ok: true, aviso: "El enlace anterior dejó de andar. Mandá el nuevo a quienes todavía no se sumaron." };
}

/** Cerrar frena altas y envíos nuevos; volver a abrirlo pide la muestra vigente. */
export async function cambiarEstadoEnlace(activityId: string, estado: "OPEN" | "CLOSED"): Promise<ResultadoEnlace> {
  if (estado !== "OPEN" && estado !== "CLOSED") return NO_EXISTE;
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  if (!r.a.exhibitorLink) return SIN_ENLACE;
  if (estado === "OPEN") {
    const cerrado = noRecibe(r.a, new Date());
    if (cerrado) return cerrado;
  }
  await prisma.culturalExhibitorLink.update({ where: { activityId: r.a.id }, data: { status: estado } });
  refrescar(r.a.id);
  return { ok: true };
}
