import type { Prisma } from "@repo/db";
import { encodeGeohash } from "@repo/geo";
import { dayEndAr, dayStartAr, isGalleryMode, toArDay, type GalleryMode } from "@repo/muestras";

export type ObraForm = {
  id?: string;
  imageUrl: string;
  title: string;
  authorName: string;
  year: number | null;
  technique: string | null;
  isHighlight: boolean;
  /** Perfil público del autor; el servidor verifica que exista. */
  authorProfileId: string | null;
  /** Sólo para mostrar en el editor; el servidor no lo lee. */
  authorProfileName?: string | null;
};

export type FichaForm = {
  id: string | null;
  type: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  organizersText: string;
  startDay: string;
  endDay: string;
  openingDay: string | null;
  scheduleText: string | null;
  priceText: string | null;
  externalUrl: string | null;
  isVirtualOnly: boolean;
  venueName: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  galleryMode: GalleryMode;
  rightsConfirmed: boolean;
  works: ObraForm[];
};

/**
 * Largo máximo de cada texto. Se recorta en vez de rechazar: el formulario no tiene estos topes y
 * no tiene sentido perder lo que la persona escribió por unos caracteres de más. Frena a quien
 * mande megas de texto salteándose el formulario.
 */
export const LARGOS = {
  title: 200,
  description: 10_000,
  organizersText: 500,
  scheduleText: 500,
  priceText: 200,
  externalUrl: 500,
  venueName: 200,
  address: 300,
  city: 120,
  province: 120,
  obraTitle: 200,
  obraAuthorName: 200,
  obraTechnique: 200,
} as const;

/** Base pública del bucket de imágenes, sin barra final. `null` si falta configurarla. */
export function baseImagenesPublicas(): string | null {
  const base = (process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  return base || null;
}

/**
 * Sólo se aceptan imágenes que subimos nosotros: `<base pública>/muestras/<clave>`. Sin esto,
 * cualquiera puede publicar una ficha cuya portada apunte a un servidor propio y enterarse de la
 * IP de cada visitante, o cambiar la imagen después de aprobada. Sin base configurada no se
 * acepta ninguna (falla cerrado).
 */
export function esImagenPropia(url: string, base: string | null): boolean {
  if (!base) return false;
  const prefijo = `${base}/muestras/`;
  if (!url.startsWith(prefijo)) return false;
  const clave = url.slice(prefijo.length);
  return /^[A-Za-z0-9._/-]+$/.test(clave) && !clave.includes("..");
}

const txt = (fd: FormData, k: string, max?: number) => {
  const v = String(fd.get(k) ?? "").trim();
  return max ? v.slice(0, max).trim() : v;
};
const opt = (fd: FormData, k: string, max?: number) => txt(fd, k, max) || null;
const num = (fd: FormData, k: string) => {
  const v = Number(txt(fd, k));
  return txt(fd, k) !== "" && Number.isFinite(v) ? v : null;
};
const corto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max).trim();

function obras(raw: string, base: string | null): ObraForm[] {
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((o) => {
      if (!o || typeof o !== "object") return [];
      const r = o as Record<string, unknown>;
      if (typeof r.imageUrl !== "string" || !esImagenPropia(r.imageUrl, base)) return [];
      return [{
        id: typeof r.id === "string" ? r.id : undefined,
        imageUrl: r.imageUrl,
        title: corto(r.title, LARGOS.obraTitle) || "Sin título",
        authorName: corto(r.authorName, LARGOS.obraAuthorName),
        year: typeof r.year === "number" && Number.isInteger(r.year) ? r.year : null,
        technique: typeof r.technique === "string" ? corto(r.technique, LARGOS.obraTechnique) || null : null,
        isHighlight: r.isHighlight === true,
        authorProfileId: typeof r.authorProfileId === "string" && /^[a-z0-9]{8,40}$/i.test(r.authorProfileId) ? r.authorProfileId : null,
      }];
    });
  } catch {
    return [];
  }
}

export type OpcionesFicha = {
  /** Base pública de las imágenes. Si no se pasa, se lee del entorno (para los tests se inyecta). */
  baseImagenes?: string | null;
};

export function fichaDesdeFormData(fd: FormData, opciones: OpcionesFicha = {}): FichaForm {
  const base = "baseImagenes" in opciones ? opciones.baseImagenes ?? null : baseImagenesPublicas();
  const virtual = fd.get("isVirtualOnly") === "on";
  const modo = txt(fd, "galleryMode");
  const portada = opt(fd, "coverImageUrl");
  return {
    id: opt(fd, "id"),
    type: txt(fd, "type"),
    title: txt(fd, "title", LARGOS.title),
    description: txt(fd, "description", LARGOS.description),
    coverImageUrl: portada && esImagenPropia(portada, base) ? portada : null,
    organizersText: txt(fd, "organizersText", LARGOS.organizersText),
    startDay: txt(fd, "startDay"),
    endDay: txt(fd, "endDay"),
    openingDay: opt(fd, "openingDay"),
    scheduleText: opt(fd, "scheduleText", LARGOS.scheduleText),
    priceText: opt(fd, "priceText", LARGOS.priceText),
    externalUrl: opt(fd, "externalUrl", LARGOS.externalUrl),
    isVirtualOnly: virtual,
    venueName: virtual ? null : opt(fd, "venueName", LARGOS.venueName),
    address: virtual ? null : opt(fd, "address", LARGOS.address),
    city: virtual ? null : opt(fd, "city", LARGOS.city),
    province: virtual ? null : opt(fd, "province", LARGOS.province),
    latitude: virtual ? null : num(fd, "latitude"),
    longitude: virtual ? null : num(fd, "longitude"),
    galleryMode: isGalleryMode(modo) ? modo : "HIGHLIGHTS_UNTIL_CLOSED",
    rightsConfirmed: fd.get("rightsConfirmed") === "on",
    works: obras(txt(fd, "works") || "[]", base),
  };
}

/** Forma AAAA-MM-DD y además un día real (descarta "2026-13-45"). */
const diaValido = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  try {
    dayStartAr(d);
    return true;
  } catch {
    return false;
  }
};

/** Lo que se escribe en la tabla. Nunca incluye estado ni dueño: eso lo deciden las acciones. */
export function datosParaGuardar(f: FichaForm) {
  const hoy = toArDay(new Date());
  const inicio = diaValido(f.startDay) ? f.startDay : hoy;
  const fin = diaValido(f.endDay) ? f.endDay : inicio;
  return {
    type: f.type,
    title: f.title,
    description: f.description,
    coverImageUrl: f.coverImageUrl,
    organizersText: f.organizersText,
    startsAt: dayStartAr(inicio),
    endsAt: dayEndAr(fin),
    openingAt: f.openingDay && diaValido(f.openingDay) ? dayStartAr(f.openingDay) : null,
    scheduleText: f.scheduleText,
    priceText: f.priceText,
    externalUrl: f.externalUrl,
    isVirtualOnly: f.isVirtualOnly,
    venueName: f.venueName,
    address: f.address,
    city: f.city,
    province: f.province,
    latitude: f.latitude,
    longitude: f.longitude,
    geohash: f.latitude != null && f.longitude != null ? encodeGeohash(f.latitude, f.longitude) : null,
    galleryMode: f.galleryMode,
    rightsConfirmedAt: f.rightsConfirmed ? new Date() : null,
  } satisfies Prisma.CulturalActivityUncheckedUpdateInput;
}
