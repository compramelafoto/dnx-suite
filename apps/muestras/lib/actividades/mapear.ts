import type { Prisma } from "@repo/db";
import { encodeGeohash } from "@repo/geo";
import { dayEndAr, dayStartAr, isGalleryMode, type GalleryMode } from "@repo/muestras";

export type ObraForm = {
  id?: string;
  imageUrl: string;
  title: string;
  authorName: string;
  year: number | null;
  technique: string | null;
  isHighlight: boolean;
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

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => txt(fd, k) || null;
const num = (fd: FormData, k: string) => {
  const v = Number(txt(fd, k));
  return txt(fd, k) !== "" && Number.isFinite(v) ? v : null;
};

function obras(raw: string): ObraForm[] {
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((o) => {
      if (!o || typeof o !== "object") return [];
      const r = o as Record<string, unknown>;
      if (typeof r.imageUrl !== "string" || !r.imageUrl) return [];
      return [{
        id: typeof r.id === "string" ? r.id : undefined,
        imageUrl: r.imageUrl,
        title: String(r.title ?? "").trim() || "Sin título",
        authorName: String(r.authorName ?? "").trim(),
        year: typeof r.year === "number" && Number.isInteger(r.year) ? r.year : null,
        technique: typeof r.technique === "string" && r.technique.trim() ? r.technique.trim() : null,
        isHighlight: r.isHighlight === true,
      }];
    });
  } catch {
    return [];
  }
}

export function fichaDesdeFormData(fd: FormData): FichaForm {
  const virtual = fd.get("isVirtualOnly") === "on";
  const modo = txt(fd, "galleryMode");
  return {
    id: opt(fd, "id"),
    type: txt(fd, "type"),
    title: txt(fd, "title"),
    description: txt(fd, "description"),
    coverImageUrl: opt(fd, "coverImageUrl"),
    organizersText: txt(fd, "organizersText"),
    startDay: txt(fd, "startDay"),
    endDay: txt(fd, "endDay"),
    openingDay: opt(fd, "openingDay"),
    scheduleText: opt(fd, "scheduleText"),
    priceText: opt(fd, "priceText"),
    externalUrl: opt(fd, "externalUrl"),
    isVirtualOnly: virtual,
    venueName: virtual ? null : opt(fd, "venueName"),
    address: virtual ? null : opt(fd, "address"),
    city: virtual ? null : opt(fd, "city"),
    province: virtual ? null : opt(fd, "province"),
    latitude: virtual ? null : num(fd, "latitude"),
    longitude: virtual ? null : num(fd, "longitude"),
    galleryMode: isGalleryMode(modo) ? modo : "HIGHLIGHTS_UNTIL_CLOSED",
    rightsConfirmed: fd.get("rightsConfirmed") === "on",
    works: obras(txt(fd, "works") || "[]"),
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
  const hoy = new Date().toISOString().slice(0, 10);
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
