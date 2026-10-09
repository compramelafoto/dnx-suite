"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  DEFAULT_WORKS_PER_PERSON, anonymousCodes, canCallAction, closeDayProblem, dayEndAr, dayStartAr, missingForOpening,
  newSlug, nextCallStatus, toArDay, type CallAction,
} from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { avisarConvocatoriaCerrada, avisarResultados } from "@/lib/correos/convocatorias";
import type { ResultadoAccion } from "@/lib/actividades/acciones";
import { DERECHOS_SUGERIDOS, REQUISITOS_SUGERIDOS, convocatoriaDesdeFormData, datosParaGuardar } from "./mapear";

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La convocatoria no existe."] };
const CAMBIO: ResultadoAccion = { ok: false, errores: ["La convocatoria cambió mientras tanto. Recargá la página."] };

function refrescar(slug?: string) {
  revalidatePath("/panel", "layout");
  revalidatePath("/convocatorias");
  if (slug) revalidatePath(`/convocatorias/${slug}`, "layout");
}

/** Crea la convocatoria de una muestra propia, en borrador y con textos sugeridos. */
export async function crearConvocatoria(activityId: string): Promise<ResultadoAccion> {
  if (typeof activityId !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, title: true, type: true, reviewStatus: true, proposedByUserId: true, call: { select: { id: true } } } });
  if (!a || (a.proposedByUserId !== usuario.id && !usuario.esSuperAdmin)) return { ok: false, errores: ["La muestra no existe."] };
  if (a.type !== "MUESTRA") return { ok: false, errores: ["Sólo una muestra puede tener convocatoria."] };
  if (a.call) return { ok: true, id: a.call.id };
  if (a.reviewStatus === "UNPUBLISHED") return { ok: false, errores: ["La muestra está despublicada: no puede tener convocatoria."] };
  if (!frenarPorUsuario("crearConvocatoria", usuario.id).allowed) {
    return { ok: false, errores: ["Creaste muchas convocatorias seguidas. Esperá un rato y probá de nuevo."] };
  }
  const hoy = toArDay(new Date());
  const enUnMes = toArDay(new Date(dayStartAr(hoy).getTime() + 30 * 24 * 60 * 60 * 1000));
  const crear = () =>
    prisma.culturalCall.create({
      data: {
        activityId: a.id, slug: newSlug(a.title), title: a.title, basesText: "", rightsText: DERECHOS_SUGERIDOS,
        requirementsText: REQUISITOS_SUGERIDOS, opensAt: dayStartAr(hoy), closesAt: dayEndAr(enUnMes),
        maxWorksPerPerson: DEFAULT_WORKS_PER_PERSON, createdByUserId: usuario.id,
      },
      select: { id: true },
    });
  let creada: { id: string };
  try {
    creada = await crear();
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2002") throw e;
    // Dos pedidos a la vez (ya existe la de esta muestra) o slug repetido (se reintenta una vez).
    const existente = await prisma.culturalCall.findUnique({ where: { activityId: a.id }, select: { id: true } });
    if (existente) return { ok: true, id: existente.id };
    creada = await crear();
  }
  refrescar();
  return { ok: true, id: creada.id };
}

/** Guarda lo que el estado deja cambiar. No cambia el estado. */
export async function guardarConvocatoria(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const f = convocatoriaDesdeFormData(fd);
  if (!f.id) return NO_EXISTE;
  const c = await prisma.culturalCall.findUnique({ where: { id: f.id }, select: { id: true, slug: true, status: true, closesAt: true, activity: { select: { proposedByUserId: true } } } });
  if (!c || (c.activity.proposedByUserId !== usuario.id && !usuario.esSuperAdmin)) return NO_EXISTE;
  if (c.status !== "DRAFT" && c.status !== "OPEN") return { ok: false, errores: ["La convocatoria ya cerró: no se puede editar."] };
  if (c.status === "OPEN" && !f.basesText) return { ok: false, errores: ["Con la convocatoria abierta, las bases no pueden quedar vacías."] };
  if (c.status === "OPEN" && !f.title) return { ok: false, errores: ["Falta el título de la convocatoria."] };
  const problema = closeDayProblem(c.status, c.closesAt, f.closesDay);
  if (problema) return { ok: false, errores: [problema] };
  let datos;
  try {
    datos = datosParaGuardar(f, c.status);
  } catch {
    return { ok: false, errores: ["Revisá las fechas."] };
  }
  const { count } = await prisma.culturalCall.updateMany({ where: { id: c.id, status: c.status }, data: datos });
  if (count === 0) return CAMBIO;
  refrescar(c.slug);
  return { ok: true, id: c.id };
}

async function transicion(id: string, accion: CallAction, extra: (ahora: Date) => Record<string, unknown>): Promise<ResultadoAccion & { slug?: string }> {
  if (typeof id !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await prisma.culturalCall.findUnique({ where: { id }, include: { activity: { select: { proposedByUserId: true, reviewStatus: true, isVirtualOnly: true, venueName: true, address: true } } } });
  if (!c) return NO_EXISTE;
  const [envios, curadores, obras] = await Promise.all([
    prisma.culturalCallSubmission.count({ where: { callId: id, status: "ACTIVE" } }),
    prisma.culturalCallCurator.count({ where: { callId: id, status: "ACTIVE" } }),
    prisma.culturalCallWork.count({ where: { callId: id, submission: { status: "ACTIVE" } } }),
  ]);
  const ahora = new Date();
  const permiso = canCallAction(accion, { status: c.status, opensAt: c.opensAt, closesAt: c.closesAt, ownerUserId: c.activity.proposedByUserId }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin }, {
    now: ahora,
    activeSubmissions: envios,
    activeCurators: curadores,
    works: obras,
    missingForOpening: accion === "open"
      ? missingForOpening({ title: c.title, basesText: c.basesText, rightsText: c.rightsText, opensDay: toArDay(c.opensAt), closesDay: toArDay(c.closesAt), maxWorksPerPerson: c.maxWorksPerPerson }, toArDay(ahora), c.activity.reviewStatus, c.activity)
      : [],
  });
  if (!permiso.ok) return { ok: false, errores: [permiso.reason] };
  const { count } = await prisma.culturalCall.updateMany({
    where: { id, status: c.status },
    data: { status: nextCallStatus(accion, c.status), ...extra(ahora) },
  });
  if (count === 0) return CAMBIO;
  refrescar(c.slug);
  return { ok: true, id, slug: c.slug };
}

export async function abrirConvocatoria(id: string) {
  return transicion(id, "open", (ahora) => ({ openedAt: ahora }));
}

export async function volverABorrador(id: string) {
  return transicion(id, "unpublish", () => ({}));
}

/**
 * Código anónimo de cada obra de un envío activo: la posición en un orden por hash. Determinista:
 * correrlo dos veces da lo mismo, así que se repite al empezar la curaduría por si el cierre se
 * cortó a mitad de camino.
 */
async function congelarCodigos(id: string) {
  const obras = await prisma.culturalCallWork.findMany({ where: { callId: id, submission: { status: "ACTIVE" } }, select: { id: true, anonymousCode: true } });
  const codigos = anonymousCodes(id, obras.map((o) => o.id));
  const pendientes = obras.filter((o) => o.anonymousCode !== codigos.get(o.id));
  if (pendientes.length === 0) return;
  // Primero se liberan todos los códigos de la convocatoria (obras retiradas incluidas) y recién
  // después se asignan, así un corrimiento de posiciones no choca con (callId, anonymousCode).
  await prisma.$transaction(
    async (tx) => {
      await tx.culturalCallWork.updateMany({ where: { callId: id, anonymousCode: { not: null } }, data: { anonymousCode: null } });
      for (const o of obras) await tx.culturalCallWork.update({ where: { id: o.id }, data: { anonymousCode: codigos.get(o.id)! } });
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/** Cierra (sólo después de la fecha de cierre), congela los códigos y avisa a quienes enviaron. */
export async function cerrarConvocatoria(id: string): Promise<ResultadoAccion> {
  const r = await transicion(id, "close", (ahora) => ({ closedAt: ahora }));
  if (!r.ok) return r;
  // Si congelar falla, el cierre ya quedó hecho y el aviso igual sale; `empezarCuraduria` lo repite.
  try {
    await congelarCodigos(id);
  } catch (e) {
    console.error("[convocatorias] no se pudieron congelar los códigos al cerrar", id, e);
  }
  await avisarConvocatoriaCerrada(id);
  return { ok: true, id };
}

export async function empezarCuraduria(id: string): Promise<ResultadoAccion> {
  if (typeof id !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const c = await prisma.culturalCall.findUnique({ where: { id }, select: { status: true, activity: { select: { proposedByUserId: true } } } });
  if (c && c.status === "CLOSED" && (c.activity.proposedByUserId === usuario.id || usuario.esSuperAdmin)) {
    try {
      await congelarCodigos(id);
    } catch {
      return { ok: false, errores: ["No se pudieron asignar los códigos anónimos. Probá de nuevo."] };
    }
  }
  return transicion(id, "startCuration", (ahora) => ({ curationStartedAt: ahora }));
}

/**
 * Cierra la curaduría: las decisiones quedan firmes, el organizador ve quién mandó cada obra y
 * se avisa a cada participante si quedó o no. Lo que quedó sin decidir cuenta como no elegido.
 */
export async function cerrarCuraduria(id: string): Promise<ResultadoAccion> {
  const r = await transicion(id, "closeCuration", (ahora) => ({ curationClosedAt: ahora }));
  if (!r.ok) return r;
  await avisarResultados(id);
  return { ok: true, id };
}
