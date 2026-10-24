import type { CourseMosaicStudent } from "@repo/template-engine";

/**
 * Los compañeros del «Mosaico del curso» de una carpeta, a partir del padrón del álbum: todos los
 * alumnos activos del curso menos el dueño, cada uno con su retrato oficial si ya lo tiene. El
 * que no tiene retrato va sólo con su nombre (se dibuja una silueta): nunca con la foto de otro.
 *
 * Puro: quien llama trae las filas del padrón y la dirección de vista de cada retrato.
 */

export type FilaDelPadron = {
  id: number;
  snapshotFirstName: string;
  snapshotLastName: string;
  mosaicPhotoId: number | null;
  mosaicPhotoAspect: number | null;
  mosaicPhotoCrop: unknown;
  /** La vista pública (con marca de agua) del retrato; null si no tiene o no se pudo armar. */
  urlDeVista: string | null;
};

function encuadre(raw: unknown): CourseMosaicStudent["crop"] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const zoom = n(r.zoom);
  const x = n(r.x);
  const y = n(r.y);
  return zoom != null && x != null && y != null ? { zoom, x, y } : undefined;
}

export function armarCompaneros(filas: FilaDelPadron[], duenoRosterEntryId: number): CourseMosaicStudent[] {
  return filas
    .filter((f) => f.id !== duenoRosterEntryId)
    .map((f) => {
      const c: CourseMosaicStudent = { firstName: f.snapshotFirstName.trim(), lastName: f.snapshotLastName.trim() };
      if (f.mosaicPhotoId == null) return c;
      c.photoId = f.mosaicPhotoId;
      if (f.urlDeVista) c.photoUrl = f.urlDeVista;
      const crop = encuadre(f.mosaicPhotoCrop);
      if (crop) c.crop = crop;
      if (f.mosaicPhotoAspect && f.mosaicPhotoAspect > 0) c.sourceAspect = f.mosaicPhotoAspect;
      return c;
    });
}
