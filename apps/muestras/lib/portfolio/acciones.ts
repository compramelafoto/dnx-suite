"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { PORTFOLIO_MAX_PHOTOS, portfolioPhotoProblems } from "@repo/muestras";
import { baseImagenesPublicas } from "@/lib/actividades/mapear";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { fotoDePortfolioDesdeFormData } from "./mapear";

export type ResultadoPortfolio = { ok: true; id?: string } | { ok: false; errores: string[] };

const SIN_SESION: ResultadoPortfolio = { ok: false, errores: ["Tenés que ingresar."] };
const SIN_PERFIL: ResultadoPortfolio = { ok: false, errores: ["Primero creá tu perfil de fotógrafo."] };
const NO_EXISTE: ResultadoPortfolio = { ok: false, errores: ["La foto no existe."] };
const MUCHAS: ResultadoPortfolio = { ok: false, errores: ["Hiciste muchos cambios seguidos. Esperá un rato y probá de nuevo."] };

type Perfil = { id: string; slug: string; userId: number };

/**
 * El perfil cuyo portfolio se toca (spec D13, D16): el propio, buscado por la cuenta en la base. El
 * super admin puede pasar otro `profileId`. Un perfil sin cuenta no tiene portfolio hasta que se
 * reclama.
 */
async function perfilParaPortfolio(usuario: Usuario, profileId: unknown): Promise<Perfil | null> {
  const otro = usuario.esSuperAdmin && typeof profileId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(profileId);
  const p = await prisma.photographerProfile.findUnique({
    where: otro ? { id: profileId as string } : { userId: usuario.id },
    select: { id: true, slug: true, userId: true },
  });
  return p && p.userId != null ? { id: p.id, slug: p.slug, userId: p.userId } : null;
}

function refrescar(slug: string) {
  revalidatePath(`/fotografos/${slug}`);
  // La sección "Artistas" de cada muestra muestra las primeras fotos.
  revalidatePath("/m", "layout");
  revalidatePath("/panel/perfil");
}

/** Las imágenes de las obras que esta persona expone o expuso: no pueden ir al portfolio (spec D15). */
async function imagenesExpuestas(p: Perfil): Promise<Set<string>> {
  const [deExpositor, enMuestras] = await Promise.all([
    prisma.culturalExhibitorWork.findMany({ where: { exhibitor: { userId: p.userId }, imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.culturalActivityWork.findMany({ where: { OR: [{ authorUserId: p.userId }, { authorProfileId: p.id }] }, select: { imageUrl: true } }),
  ]);
  return new Set([...deExpositor, ...enMuestras].flatMap((w) => (w.imageUrl ? [w.imageUrl] : [])));
}

/** Suma o corrige una foto del portfolio. Sólo la dueña del perfil (o el super admin). */
export async function guardarFotoDePortfolio(fd: FormData): Promise<ResultadoPortfolio> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("guardarPortfolio", usuario.id).allowed) return MUCHAS;
  const perfil = await perfilParaPortfolio(usuario, fd.get("profileId"));
  if (!perfil) return SIN_PERFIL;
  const f = fotoDePortfolioDesdeFormData(fd, baseImagenesPublicas(), [...new Set([usuario.id, perfil.userId])]);
  if (f.imagenAjena) return { ok: false, errores: ["Subí la foto desde acá."] };
  let previa: { id: string } | null = null;
  if (f.id) {
    previa = await prisma.photographerPortfolioPhoto.findFirst({ where: { id: f.id, profileId: perfil.id }, select: { id: true } });
    if (!previa) return NO_EXISTE;
  }
  const [expuestas, cuantas] = await Promise.all([
    imagenesExpuestas(perfil),
    prisma.photographerPortfolioPhoto.count({ where: { profileId: perfil.id } }),
  ]);
  const problemas = portfolioPhotoProblems({ ...f, exhibitedUrls: expuestas, count: cuantas, isNew: !previa });
  if (problemas.length) return { ok: false, errores: problemas };
  const datos = { imageUrl: f.imageUrl!, title: f.title.trim(), year: f.year, technique: f.technique?.trim() || null, caption: f.caption?.trim() || null };
  if (previa) {
    await prisma.photographerPortfolioPhoto.update({ where: { id: previa.id }, data: datos });
    refrescar(perfil.slug);
    return { ok: true, id: previa.id };
  }
  const ultimo = await prisma.photographerPortfolioPhoto.aggregate({ where: { profileId: perfil.id }, _max: { sortOrder: true } });
  const creada = await prisma.photographerPortfolioPhoto.create({
    data: { ...datos, profileId: perfil.id, sortOrder: (ultimo._max.sortOrder ?? -1) + 1 },
    select: { id: true },
  });
  refrescar(perfil.slug);
  return { ok: true, id: creada.id };
}

export async function borrarFotoDePortfolio(id: string, profileId?: string): Promise<ResultadoPortfolio> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NO_EXISTE;
  if (!frenarPorUsuario("guardarPortfolio", usuario.id).allowed) return MUCHAS;
  const perfil = await perfilParaPortfolio(usuario, profileId);
  if (!perfil) return SIN_PERFIL;
  const r = await prisma.photographerPortfolioPhoto.deleteMany({ where: { id, profileId: perfil.id } });
  if (r.count === 0) return NO_EXISTE;
  refrescar(perfil.slug);
  return { ok: true };
}

/** Nuevo orden: sólo cuentan los ids de este perfil; los que falten quedan al final, en su orden. */
export async function ordenarPortfolio(ids: string[], profileId?: string): Promise<ResultadoPortfolio> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!Array.isArray(ids) || ids.length > PORTFOLIO_MAX_PHOTOS * 2) return NO_EXISTE;
  if (!frenarPorUsuario("guardarPortfolio", usuario.id).allowed) return MUCHAS;
  const perfil = await perfilParaPortfolio(usuario, profileId);
  if (!perfil) return SIN_PERFIL;
  const propias = await prisma.photographerPortfolioPhoto.findMany({ where: { profileId: perfil.id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const suyas = new Set(propias.map((p) => p.id));
  const pedidas = [...new Set(ids.filter((i) => typeof i === "string" && suyas.has(i)))];
  const orden = [...pedidas, ...propias.map((p) => p.id).filter((i) => !pedidas.includes(i))];
  await prisma.$transaction(orden.map((id, i) => prisma.photographerPortfolioPhoto.update({ where: { id }, data: { sortOrder: i } })));
  refrescar(perfil.slug);
  return { ok: true };
}
