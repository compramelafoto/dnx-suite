import type { Armador } from "../lienzo";

/** Un modelo de librito: sus dos fondos (SVG) y sus bloques. */
export type Modelo = {
  /** Parte estable de los ids y de los nombres de archivo. No cambiar una vez cargado. */
  slug: string;
  nombre: string;
  descripcion: string;
  /** Para agrupar en el catálogo: Jardín, Primaria, Secundaria, Egresados, Formal, Informal. */
  categoria: string;
  fondoExterior: () => string;
  fondoInterior: () => string;
  /** Agrega los bloques. Los fondos se agregan solos (zIndex 1 de cada página). */
  armar: (a: Armador) => void;
};

export const archivoFondo = (slug: string, pagina: "exterior" | "interior") => `librito-${slug}-${pagina}.jpg`;
export const archivoMiniatura = (slug: string) => `librito-${slug}-miniatura.jpg`;
