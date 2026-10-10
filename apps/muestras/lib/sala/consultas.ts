import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import {
  fichaDetail, parseVisibility, roomExhibitedWorks, roomPassCookieName, roomPassValid, showBuyButton, visibleWorks, type RoomPass,
} from "@repo/muestras";
import { esDelEquipo } from "@/lib/equipo/permisos";
import { esUrlWeb } from "@/lib/url";
import { leerPase, llaveExistente } from "./llave";

/**
 * Vista de sala (spec D31, D32). Es lo **único** público que lee la cookie del pase: las páginas
 * de la muestra siguen en caché y nunca la miran. Todo lo que sale de acá va al HTML de una página
 * dinámica y privada: ninguna URL del bucket de una obra (las imágenes van por
 * `/m/<slug>/sala/img/<id>`) y nunca el precio.
 */

const SLUG = /^[a-z0-9-]{1,120}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const MUESTRA = {
  id: true, slug: true, title: true, type: true, reviewStatus: true, galleryMode: true, visibility: true, startsAt: true, endsAt: true,
} as const;

export type MuestraDeSala = { id: string; slug: string; title: string; galleryMode: string; visibility: unknown; startsAt: Date; endsAt: Date };
/** `huella`: de la cookie del pase, sólo si es válido (para contar el freno por pase, nunca la cookie). */
export type PaseDeSala = { actividad: MuestraDeSala; pase: RoomPass | null; equipo: boolean; huella?: string | null };

/**
 * La muestra publicada, el pase de este teléfono (firma de esta muestra y vigente) y si quien mira
 * es del equipo (que ve "como en la sala" todo). `null` si la muestra no está publicada.
 */
export async function paseDeSala(slug: string): Promise<PaseDeSala | null> {
  if (!SLUG.test(slug)) return null;
  const a = await prisma.culturalActivity.findUnique({ where: { slug }, select: MUESTRA });
  if (!a || a.type !== "MUESTRA" || a.reviewStatus !== "APPROVED") return null;
  const actividad: MuestraDeSala = {
    id: a.id, slug: a.slug, title: a.title, galleryMode: a.galleryMode, visibility: a.visibility, startsAt: a.startsAt, endsAt: a.endsAt,
  };
  const valor = (await cookies()).get(roomPassCookieName(a.id))?.value ?? null;
  let pase: RoomPass | null = null;
  if (valor) {
    // Para leer no se crea la llave: si no existe, ningún pase puede ser válido.
    const llave = await llaveExistente(a.id);
    const leido = llave ? leerPase(valor, llave) : null;
    pase = roomPassValid(leido, a.id, new Date()) ? leido : null;
  }
  const huella = pase && valor ? createHash("sha256").update(valor).digest("base64url").slice(0, 22) : null;
  return { actividad, pase, equipo: await esDelEquipo(a.id), huella };
}

const OBRA = { id: true, title: true, authorName: true, authorProfileId: true, year: true, technique: true, isHighlight: true, sortOrder: true } as const;
type ObraDeMuestra = { id: string; title: string; authorName: string; authorProfileId: string | null; year: number | null; technique: string | null; isHighlight: boolean; sortOrder: number };

/**
 * Las obras que este pase deja ver: las que permite "QR de la sala" según lo escaneado, más las que
 * ya se ven online. El equipo ve todas. Sin pase ni equipo, ninguna.
 */
export function obrasPermitidas(p: PaseDeSala, works: readonly ObraDeMuestra[], ahora: Date): ObraDeMuestra[] {
  if (p.equipo) return [...works].sort((x, y) => x.sortOrder - y.sortOrder);
  if (!p.pase) return [];
  const v = parseVisibility(p.actividad.visibility, p.actividad.galleryMode);
  const enSala = new Set(roomExhibitedWorks(v, works, p.pase.w).map((w) => w.id));
  const online = new Set(visibleWorks(p.actividad, [...works], ahora).works.map((w) => w.id));
  return [...works].filter((w) => enSala.has(w.id) || online.has(w.id)).sort((x, y) => x.sortOrder - y.sortOrder);
}

const imagenDeSala = (slug: string, id: string) => `/m/${encodeURIComponent(slug)}/sala/img/${encodeURIComponent(id)}`;

function obrasDe(activityId: string) {
  return prisma.culturalActivityWork.findMany({ where: { activityId }, select: OBRA, orderBy: { sortOrder: "asc" } });
}

/**
 * Una obra en la vista de sala con su artista, sus otras obras permitidas, su portfolio y sus otras
 * muestras (según el ajuste "QR de la sala"). `null` si el pase no la deja ver: la página redirige
 * a la versión pública.
 */
export async function vistaDeSala(p: PaseDeSala, workId: string) {
  if (!ID.test(workId) || (!p.pase && !p.equipo)) return null;
  const ahora = new Date();
  const a = p.actividad;
  const v = parseVisibility(a.visibility, a.galleryMode);
  const permitidas = obrasPermitidas(p, await obrasDe(a.id), ahora);
  const obra = permitidas.find((w) => w.id === workId);
  if (!obra) return null;

  // Sin el precio ni las notas para el montaje: sólo lo que va en la sala.
  const ex = await prisma.culturalExhibitorWork.findFirst({
    where: { activityId: a.id, activityWorkId: obra.id },
    select: { imageWidthCm: true, imageHeightCm: true, edition: true, editionNumber: true, editionSize: true, statement: true, forSale: true },
  });
  const perfil = obra.authorProfileId
    ? await prisma.photographerProfile.findUnique({
        where: { id: obra.authorProfileId },
        select: {
          id: true, slug: true, displayName: true, bio: true, city: true, province: true, website: true, instagram: true, avatarUrl: true,
          portfolio: v.room.portfolio
            ? { orderBy: { sortOrder: "asc" }, take: 60, select: { id: true, imageUrl: true, title: true, year: true, technique: true, caption: true } }
            : false,
        },
      })
    : null;
  const otrasMuestras = perfil && v.room.otherExhibitions
    ? await prisma.culturalActivity.findMany({
        where: { id: { not: a.id }, type: "MUESTRA", reviewStatus: "APPROVED", works: { some: { authorProfileId: perfil.id } } },
        select: { slug: true, title: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: "desc" },
        take: 12,
      })
    : [];
  // "Otras obras de <artista> en esta muestra": del mismo artista y que este pase deja ver.
  const delArtista = roomExhibitedWorks({ ...v, room: { ...v.room, exhibited: "ARTIST" } }, permitidas, [obra.id]).filter((w) => w.id !== obra.id);

  return {
    muestra: { id: a.id, slug: a.slug, title: a.title },
    obra: {
      id: obra.id,
      title: obra.title,
      authorName: obra.authorName.trim() || "Autor sin indicar",
      detalle: ex ? fichaDetail({ ...ex, year: obra.year, technique: obra.technique }) : [obra.year ? String(obra.year) : null, obra.technique?.trim() || null].filter(Boolean).join(". "),
      statement: ex?.statement?.trim() || null,
      imagen: imagenDeSala(a.slug, obra.id),
    },
    artista: perfil
      ? {
          slug: perfil.slug, nombre: perfil.displayName, bio: perfil.bio, ciudad: [perfil.city, perfil.province].filter(Boolean).join(", ") || null,
          website: esUrlWeb(perfil.website) ? perfil.website : null, instagram: perfil.instagram,
          avatarUrl: esUrlWeb(perfil.avatarUrl) ? perfil.avatarUrl : null,
        }
      : null,
    // Las fotos del portfolio son públicas (están en el perfil): van directo.
    portfolio: (perfil && "portfolio" in perfil && Array.isArray(perfil.portfolio) ? perfil.portfolio : []).filter((f) => esUrlWeb(f.imageUrl)),
    otrasObras: delArtista.map((w) => ({ id: w.id, title: w.title, imagen: imagenDeSala(a.slug, w.id) })),
    otrasMuestras,
    mostrarAdquirir: showBuyButton({ roomBuy: v.room.buy, forSale: ex?.forSale ?? false }),
    vence: p.pase?.exp ?? null,
  };
}

/** "Lo que escaneaste": las obras del pase (el equipo ve las permitidas), con miniaturas por proxy. */
export async function escaneadoEnSala(p: PaseDeSala) {
  if (!p.pase && !p.equipo) return null;
  const a = p.actividad;
  const permitidas = obrasPermitidas(p, await obrasDe(a.id), new Date());
  const escaneadas = p.pase ? new Set(p.pase.w) : null;
  return {
    muestra: { id: a.id, slug: a.slug, title: a.title },
    obras: permitidas
      .filter((w) => !escaneadas || escaneadas.has(w.id) || p.equipo)
      .map((w) => ({ id: w.id, title: w.title, authorName: w.authorName.trim() || "Autor sin indicar", imagen: imagenDeSala(a.slug, w.id) })),
    vence: p.pase?.exp ?? null,
  };
}

/** La URL del bucket de una obra que este pase deja ver; `null` si no (la ruta responde 404). */
export async function imagenDeSalaPermitida(slug: string, id: string, leido?: PaseDeSala | null): Promise<string | null> {
  if (!ID.test(id)) return null;
  const p = leido === undefined ? await paseDeSala(slug) : leido;
  if (!p || (!p.pase && !p.equipo)) return null;
  const works = await obrasDe(p.actividad.id);
  if (!obrasPermitidas(p, works, new Date()).some((w) => w.id === id)) return null;
  const w = await prisma.culturalActivityWork.findFirst({ where: { id, activityId: p.actividad.id }, select: { imageUrl: true } });
  return w?.imageUrl ?? null;
}

/** Para "Adquirir obra": la obra permitida y si está marcada para vender. Nunca el precio. */
export async function obraParaAdquirir(p: PaseDeSala, workId: string) {
  if (!ID.test(workId) || (!p.pase && !p.equipo)) return null;
  const permitidas = obrasPermitidas(p, await obrasDe(p.actividad.id), new Date());
  const obra = permitidas.find((w) => w.id === workId);
  if (!obra) return null;
  const ex = await prisma.culturalExhibitorWork.findFirst({ where: { activityId: p.actividad.id, activityWorkId: obra.id }, select: { forSale: true } });
  const v = parseVisibility(p.actividad.visibility, p.actividad.galleryMode);
  return { id: obra.id, title: obra.title, authorName: obra.authorName.trim() || "Autor sin indicar", forSale: ex?.forSale ?? false, roomBuy: v.room.buy };
}
