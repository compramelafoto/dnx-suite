import "server-only";
import { prisma } from "@repo/db";
import { getFotofficeR2PublicUrl } from "@/lib/images/r2-client";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { loadAboutMe } from "./repository";
import { MAX_FEATURED_PHOTOS, type AboutMe, type ParseAboutMeResult } from "./about";

/**
 * «Más sobre mí» del lado del socio: qué ve al abrir la pestaña y cómo se guarda.
 *
 * Se resuelve la misma ficha que el resto del portal (la más antigua activa): quien pertenezca a
 * dos instituciones edita la que está viendo.
 */

async function fichaDelSocio(userId: number) {
  return prisma.member.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      workspaceId: true,
      firstName: true,
      phone: true,
      workspace: { select: { name: true } },
    },
  });
}

/** El prefijo donde caen las fotos que un socio sube sólo para su placa. */
export function featuredPhotoPrefix(workspaceId: string, memberId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.memberFeaturedPhoto}/${workspaceId}/${memberId}`;
}

export type AboutMeScreen = {
  memberId: string;
  workspaceId: string;
  institution: string;
  firstName: string;
  phone: string | null;
  about: AboutMe | null;
  portfolioPhotos: { url: string; width: number; height: number }[];
};

export async function loadAboutMeScreen(userId: number): Promise<AboutMeScreen | null> {
  const socio = await fichaDelSocio(userId);
  if (!socio) return null;
  const [about, portfolio] = await Promise.all([
    loadAboutMe(socio.id),
    prisma.fotofficeMemberPortfolio.findUnique({
      where: { memberId: socio.id },
      select: { photos: { orderBy: { order: "asc" }, select: { url: true, width: true, height: true } } },
    }),
  ]);
  return {
    memberId: socio.id,
    workspaceId: socio.workspaceId,
    institution: socio.workspace.name,
    firstName: socio.firstName,
    phone: socio.phone,
    about,
    portfolioPhotos: portfolio?.photos ?? [],
  };
}

/**
 * Las direcciones de foto que este socio puede poner en su placa: las de su portfolio y las que
 * subió para esto. Ninguna otra: si no, cualquiera podría poner en la placa institucional una
 * imagen de cualquier lado.
 */
export async function allowedFeaturedUrls(input: {
  workspaceId: string;
  memberId: string;
  candidates: readonly string[];
}): Promise<Set<string>> {
  const portfolio = await prisma.fotofficeMemberPortfolio.findUnique({
    where: { memberId: input.memberId },
    select: { photos: { select: { url: true } } },
  });
  const permitidas = new Set((portfolio?.photos ?? []).map((p) => p.url));
  const propias = `${getFotofficeR2PublicUrl(featuredPhotoPrefix(input.workspaceId, input.memberId))}/`;
  for (const u of input.candidates) if (u.startsWith(propias)) permitidas.add(u);
  return permitidas;
}

export async function memberForAboutMe(userId: number) {
  return fichaDelSocio(userId);
}

export async function saveAboutMe(input: {
  memberId: string;
  workspaceId: string;
  value: Extract<ParseAboutMeResult, { ok: true }>["value"];
}): Promise<void> {
  const { spotlightNotice, ...resto } = input.value;
  const actual = await prisma.memberAboutMe.findUnique({
    where: { memberId: input.memberId },
    select: { spotlightNoticeAt: true },
  });
  // La fecha del aviso es la primera vez que lo aceptó; desmarcarlo la borra.
  const spotlightNoticeAt = spotlightNotice ? (actual?.spotlightNoticeAt ?? new Date()) : null;
  await prisma.memberAboutMe.upsert({
    where: { memberId: input.memberId },
    create: { memberId: input.memberId, workspaceId: input.workspaceId, ...resto, spotlightNoticeAt },
    update: { ...resto, spotlightNoticeAt },
  });
}

/**
 * Suma una foto recién subida a las de la placa, si queda lugar. Devuelve la lista nueva.
 *
 * Se guarda en el momento y no al apretar "Guardar": una foto subida que se pierde por no haber
 * guardado el formulario es una foto que el socio cree que eligió.
 */
export async function appendFeaturedPhoto(input: {
  memberId: string;
  workspaceId: string;
  url: string;
}): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  const actual = await prisma.memberAboutMe.findUnique({
    where: { memberId: input.memberId },
    select: { featuredPhotoUrls: true },
  });
  const urls = actual?.featuredPhotoUrls ?? [];
  if (urls.includes(input.url)) return { ok: true, urls };
  if (urls.length >= MAX_FEATURED_PHOTOS) {
    return { ok: false, error: `Ya elegiste ${MAX_FEATURED_PHOTOS} fotos. Sacá una para sumar otra.` };
  }
  const nuevas = [...urls, input.url];
  await prisma.memberAboutMe.upsert({
    where: { memberId: input.memberId },
    create: { memberId: input.memberId, workspaceId: input.workspaceId, featuredPhotoUrls: nuevas },
    update: { featuredPhotoUrls: nuevas },
  });
  return { ok: true, urls: nuevas };
}
