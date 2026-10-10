"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import {
  exhibitorCountProblem, exhibitorLinkState, exhibitorWorkProblems, exhibitorWorkTransition, temporalStatus,
} from "@repo/muestras";
import { baseImagenesPublicas } from "@/lib/actividades/mapear";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { obraDesdeFormData } from "./mapear";

export type ResultadoObra = { ok: true; id?: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoObra => ({ ok: false, errores: [texto] });
const SIN_SESION = error("Tenés que ingresar.");
const NO_EXISTE = error("La obra no existe.");
const SIN_PARTICIPACION = error("No encontramos tu participación en esa muestra.");
const MUCHAS = error("Hiciste muchos cambios seguidos. Esperá un rato y probá de nuevo.");
const CAMBIO = error("La obra cambió mientras la editabas. Recargá la página.");
const ENLACE_CERRADO = error("El enlace de expositores está cerrado: ya no se reciben obras nuevas.");
const SIN_BIO = error("Antes de enviar, completá tu biografía: es lo que el público lee de vos.");

const esId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

/** La participación con lo que deciden las reglas: estado, muestra, enlace y biografía del perfil. */
const EXPOSITOR = {
  id: true, userId: true, status: true, activityId: true,
  profile: { select: { bio: true } },
  activity: {
    select: {
      id: true, type: true, reviewStatus: true, isCancelled: true, startsAt: true, endsAt: true,
      exhibitorLink: { select: { status: true, closesAt: true, maxWorksPerExhibitor: true } },
    },
  },
} as const;
type Expositor = Prisma.CulturalExhibitorGetPayload<{ select: typeof EXPOSITOR }>;

const OBRA = {
  id: true, status: true, activityId: true, activityWorkId: true, exhibitorId: true,
  imageUrl: true, title: true, year: true, technique: true, imageWidthCm: true, imageHeightCm: true, frameWidthCm: true,
  frameHeightCm: true, edition: true, editionNumber: true, editionSize: true, statement: true, forSale: true, priceArs: true,
  hangingNotes: true,
  exhibitor: { select: EXPOSITOR },
} as const;

/**
 * Siempre por la cuenta: una obra de otra participación "no existe" (spec D11). Tampoco una cuya
 * muestra no coincide con la de su participación (la base no lo impide: lo controla la app).
 */
async function obraPropia(id: string, usuario: Usuario) {
  const w = await prisma.culturalExhibitorWork.findFirst({ where: { id, exhibitor: { userId: usuario.id } }, select: OBRA });
  return w && w.activityId === w.exhibitor.activityId ? w : null;
}

/** Lo que frena cualquier cambio de quien expone, más allá del estado de la obra (spec D10). */
function frenoDeMuestra(e: Expositor, ahora: Date): ResultadoObra | null {
  if (e.status !== "ACTIVE") return error("Quien organiza te sacó de esta muestra.");
  if (e.activity.isCancelled) return error("La muestra está cancelada.");
  if (temporalStatus(e.activity, ahora) === "CLOSED") return error("La muestra ya cerró.");
  return null;
}

const enlaceAbierto = (e: Expositor, ahora: Date) => exhibitorLinkState(e.activity.exhibitorLink, e.activity, ahora) === "OPEN";

function refrescar(e: { id: string; activityId: string }) {
  revalidatePath(`/panel/expositor/${e.id}`);
  revalidatePath("/panel/expositor");
  revalidatePath(`/panel/muestras/${e.activityId}/expositores`);
}

/**
 * Crea o corrige una obra propia (borrador o con cambios pedidos). Se guarda incompleta: lo
 * obligatorio se exige al enviarla. La obra nueva toma siempre la muestra de la participación,
 * nunca una que llegue del formulario.
 */
export async function guardarObraDeExpositor(fd: FormData): Promise<ResultadoObra> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("guardarObraExpositor", usuario.id).allowed) return MUCHAS;
  const obra = obraDesdeFormData(fd, baseImagenesPublicas(), usuario.id);
  if (obra.imagenAjena) return error("Subí la foto desde acá.");
  const ahora = new Date();

  let previa: Awaited<ReturnType<typeof obraPropia>> = null;
  let e: Expositor | null;
  if (obra.id) {
    previa = await obraPropia(obra.id, usuario);
    if (!previa) return NO_EXISTE;
    e = previa.exhibitor;
  } else {
    const exhibitorId = fd.get("exhibitorId");
    e = esId(exhibitorId) ? await prisma.culturalExhibitor.findFirst({ where: { id: exhibitorId, userId: usuario.id }, select: EXPOSITOR }) : null;
    if (!e) return SIN_PARTICIPACION;
  }
  const frenada = frenoDeMuestra(e, ahora);
  if (frenada) return frenada;

  if (previa) {
    const t = exhibitorWorkTransition("edit", previa.status, {});
    if (!t.ok) return error(t.reason);
  } else {
    if (!enlaceAbierto(e, ahora)) return ENLACE_CERRADO;
    const cuantas = await prisma.culturalExhibitorWork.count({ where: { exhibitorId: e.id, status: { not: "REMOVED" } } });
    const tope = exhibitorCountProblem({ current: cuantas, max: e.activity.exhibitorLink?.maxWorksPerExhibitor ?? null });
    if (tope) return error(tope);
  }

  const problemas = exhibitorWorkProblems(obra.datos, { forSubmit: false, now: ahora });
  if (problemas.length) return { ok: false, errores: problemas };
  const datos = { ...obra.datos, title: obra.datos.title.trim(), editionNumber: obra.datos.editionNumber ?? null, editionSize: obra.datos.editionSize ?? null };

  if (previa) {
    // Por id, por participación y por estado: si cambió en el medio (la revisaron), no se pisa.
    const r = await prisma.culturalExhibitorWork.updateMany({ where: { id: previa.id, exhibitorId: e.id, status: previa.status }, data: datos });
    if (r.count === 0) return CAMBIO;
    refrescar(e);
    return { ok: true, id: previa.id };
  }
  const ultimo = await prisma.culturalExhibitorWork.aggregate({ where: { exhibitorId: e.id }, _max: { sortOrder: true } });
  const creada = await prisma.culturalExhibitorWork.create({
    data: { ...datos, exhibitorId: e.id, activityId: e.activityId, status: "DRAFT", sortOrder: (ultimo._max.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
  refrescar(e);
  return { ok: true, id: creada.id };
}

/** Sólo un borrador, o una obra con cambios pedidos que nunca entró a la muestra. */
export async function borrarObraDeExpositor(id: string): Promise<ResultadoObra> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!esId(id)) return NO_EXISTE;
  if (!frenarPorUsuario("guardarObraExpositor", usuario.id).allowed) return MUCHAS;
  const w = await obraPropia(id, usuario);
  if (!w) return NO_EXISTE;
  const se = w.status === "DRAFT" || (w.status === "CHANGES_REQUESTED" && !w.activityWorkId);
  if (!se) return error("Esta obra ya no se puede borrar.");
  const r = await prisma.culturalExhibitorWork.deleteMany({ where: { id: w.id, exhibitorId: w.exhibitor.id, status: w.status } });
  if (r.count === 0) return CAMBIO;
  refrescar(w.exhibitor);
  return { ok: true };
}

/** "Enviar a la organización": completa, con el enlace abierto (si es nueva) y con biografía. */
export async function enviarObraDeExpositor(id: string): Promise<ResultadoObra> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!esId(id)) return NO_EXISTE;
  if (!frenarPorUsuario("enviarObraExpositor", usuario.id).allowed) return MUCHAS;
  const w = await obraPropia(id, usuario);
  if (!w) return NO_EXISTE;
  const e = w.exhibitor;
  const ahora = new Date();
  const frenada = frenoDeMuestra(e, ahora);
  if (frenada) return frenada;
  // Primero si se puede enviar en este estado; después qué le falta, así la lista es útil.
  const t = exhibitorWorkTransition("submit", w.status, { linkOpen: enlaceAbierto(e, ahora), complete: true });
  if (!t.ok) return error(t.reason);
  const problemas = exhibitorWorkProblems(w, { forSubmit: true, now: ahora });
  if (problemas.length) return { ok: false, errores: problemas };
  if (!e.profile?.bio?.trim()) return SIN_BIO;
  const r = await prisma.culturalExhibitorWork.updateMany({
    where: { id: w.id, exhibitorId: e.id, status: w.status },
    data: { status: t.next, submittedAt: ahora },
  });
  if (r.count === 0) return CAMBIO;
  refrescar(e);
  return { ok: true };
}

/** "Retirar el envío": vuelve a borrador mientras nadie la revisó. */
export async function retirarObraDeExpositor(id: string): Promise<ResultadoObra> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!esId(id)) return NO_EXISTE;
  if (!frenarPorUsuario("guardarObraExpositor", usuario.id).allowed) return MUCHAS;
  const w = await obraPropia(id, usuario);
  if (!w) return NO_EXISTE;
  const t = exhibitorWorkTransition("withdraw", w.status, {});
  if (!t.ok) return error(t.reason);
  const r = await prisma.culturalExhibitorWork.updateMany({
    where: { id: w.id, exhibitorId: w.exhibitor.id, status: w.status },
    data: { status: t.next, submittedAt: null },
  });
  if (r.count === 0) return CAMBIO;
  refrescar(w.exhibitor);
  return { ok: true };
}
