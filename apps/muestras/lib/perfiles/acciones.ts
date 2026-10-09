"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { freeProfileSlug, profileSlugBase } from "@repo/muestras";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";
import { perfilDesdeFormData } from "./mapear";

export type ResultadoPerfil = { ok: true; slug: string } | { ok: false; errores: string[] };
export type PerfilEncontrado = { id: string; displayName: string; slug: string; city: string | null };

const SLUG_OCUPADO: ResultadoPerfil = { ok: false, errores: ["Esa dirección ya la usa otro perfil. Elegí otra."] };

/** Prisma avisa con P2002 cuando un índice único frena la escritura. */
function esChoqueUnico(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

function refrescarPerfiles(...slugs: string[]) {
  revalidatePath("/fotografos");
  for (const s of slugs) revalidatePath(`/fotografos/${s}`);
  revalidatePath("/m/[slug]/o/[workId]", "page");
  revalidatePath("/panel", "layout");
}

/** Crea o actualiza el perfil propio. Cada cuenta tiene uno solo. */
export async function guardarPerfil(fd: FormData): Promise<ResultadoPerfil> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, errores: ["Tenés que ingresar."] };
  if (!frenarPorUsuario("guardarPerfil", usuario.id).allowed) {
    return { ok: false, errores: ["Guardaste muchas veces seguidas. Esperá un rato y probá de nuevo."] };
  }
  const leido = perfilDesdeFormData(fd);
  if (!leido.ok) return leido;
  const p = leido.perfil;

  const actual = await prisma.photographerProfile.findUnique({ where: { userId: usuario.id }, select: { id: true, slug: true } });

  let slug: string;
  if (p.slug) {
    if (p.slug !== actual?.slug) {
      const otro = await prisma.photographerProfile.findUnique({ where: { slug: p.slug }, select: { id: true } });
      if (otro && otro.id !== actual?.id) return SLUG_OCUPADO;
    }
    slug = p.slug;
  } else if (actual) {
    slug = actual.slug;
  } else {
    const base = profileSlugBase(p.displayName);
    const parecidos = await prisma.photographerProfile.findMany({ where: { slug: { startsWith: base.slice(0, 30) } }, select: { slug: true } });
    slug = freeProfileSlug(base, new Set(parecidos.map((x) => x.slug)));
  }

  const datos = {
    slug, displayName: p.displayName, bio: p.bio, city: p.city, province: p.province,
    website: p.website, instagram: p.instagram, avatarUrl: p.avatarUrl,
  };
  try {
    if (actual) await prisma.photographerProfile.update({ where: { id: actual.id }, data: datos });
    else await prisma.photographerProfile.create({ data: { ...datos, userId: usuario.id } });
  } catch (err) {
    // Dos guardados a la vez, o alguien tomó la dirección en el medio: lo frena el índice único.
    if (esChoqueUnico(err)) return SLUG_OCUPADO;
    throw err;
  }
  refrescarPerfiles(slug, ...(actual && actual.slug !== slug ? [actual.slug] : []));
  return { ok: true, slug };
}

/** "No es mía": quita una obra del perfil propio. La última palabra la tiene el dueño del perfil. */
export async function desvincularObra(workId: string): Promise<{ ok: boolean }> {
  if (typeof workId !== "string") return { ok: false };
  const usuario = await getUsuario();
  if (!usuario) return { ok: false };
  const perfil = await prisma.photographerProfile.findUnique({ where: { userId: usuario.id }, select: { id: true, slug: true } });
  if (!perfil) return { ok: false };
  const { count } = await prisma.culturalActivityWork.updateMany({
    where: { id: workId, authorProfileId: perfil.id },
    data: { authorProfileId: null },
  });
  if (count > 0) refrescarPerfiles(perfil.slug);
  return { ok: count > 0 };
}

/** Para vincular una obra a un perfil desde el editor. Con sesión, dos letras como mínimo y freno. */
export async function buscarPerfiles(q: string): Promise<PerfilEncontrado[]> {
  if (typeof q !== "string") return [];
  const texto = q.trim().slice(0, 80);
  if (texto.length < 2) return [];
  const usuario = await getUsuario();
  if (!usuario) return [];
  if (!frenarPorUsuario("buscarPerfiles", usuario.id).allowed) return [];
  return prisma.photographerProfile.findMany({
    where: { displayName: { contains: texto, mode: "insensitive" } },
    select: { id: true, displayName: true, slug: true, city: true },
    orderBy: { displayName: "asc" },
    take: 8,
  });
}
