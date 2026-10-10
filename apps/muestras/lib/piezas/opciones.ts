import {
  isCatalogSize, isFrameSize, isGuestbookPosterSize, isOrientation, isPosterSize,
  type CatalogSize, type FrameSize, type GuestbookPosterSize, type Orientation, type PosterSize,
} from "@repo/muestras";

export const PIEZAS = ["marcos", "cartel", "catalogo", "montaje", "libro"] as const;
export type Pieza = (typeof PIEZAS)[number];
/** Llevan un QR a una página pública: piden la muestra publicada (D11). */
export const PIEZAS_CON_QR: readonly Pieza[] = ["cartel", "catalogo", "libro"];

export type OpcionesPieza =
  | { pieza: "marcos"; tamano: FrameSize; orientacion: Orientation; conFoto: boolean; obra: string | null }
  | { pieza: "cartel"; tamano: PosterSize }
  | { pieza: "catalogo"; tamano: CatalogSize }
  | { pieza: "libro"; tamano: GuestbookPosterSize }
  | { pieza: "montaje" };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Las opciones de la dirección, con valores por defecto para lo que no se entiende. */
export function opcionesDePieza(pieza: string, sp: URLSearchParams): OpcionesPieza | null {
  const t = sp.get("tamano");
  switch (pieza) {
    case "marcos": {
      const o = sp.get("orientacion");
      const obra = sp.get("obra");
      return {
        pieza, tamano: isFrameSize(t) ? t : "A4", orientacion: isOrientation(o) ? o : "AUTO",
        conFoto: sp.get("foto") !== "no", obra: obra && ID.test(obra) ? obra : null,
      };
    }
    case "cartel": return { pieza, tamano: isPosterSize(t) ? t : "A3" };
    case "catalogo": return { pieza, tamano: isCatalogSize(t) ? t : "A5" };
    case "libro": return { pieza, tamano: isGuestbookPosterSize(t) ? t : "A4" };
    case "montaje": return { pieza };
    default: return null;
  }
}

export function urlDePieza(id: string, o: OpcionesPieza): string {
  const q = new URLSearchParams();
  if (o.pieza !== "montaje") q.set("tamano", o.tamano);
  if (o.pieza === "marcos") {
    q.set("orientacion", o.orientacion);
    if (!o.conFoto) q.set("foto", "no");
    if (o.obra) q.set("obra", o.obra);
  }
  const s = q.toString();
  return `/api/piezas/${encodeURIComponent(id)}/${o.pieza}${s ? `?${s}` : ""}`;
}
