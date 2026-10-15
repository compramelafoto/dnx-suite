import type { Armador } from "../lienzo";

/** Un modelo de librito: sus dos fondos (SVG) y sus bloques. */
export type Modelo = {
  /** Parte estable de los ids y de los nombres de archivo. No cambiar una vez cargado. */
  slug: string;
  nombre: string;
  descripcion: string;
  /** Para agrupar en el catálogo: Jardín, Primaria, Secundaria, Egresados, Formal, Informal, Religioso. */
  categoria: string;
  /**
   * Filtros del catálogo. Los que salen de la plantilla (orientación, cantidad de fotos, listado,
   * logo) los calcula `definiciones.ts`; acá va lo que es de criterio.
   */
  filtros?: {
    estilo: "Formal" | "Informal" | "Divertido" | "Moderno" | "Clásico" | "Minimalista";
    evento?: string;
    /**
     * Cómo se lee el librito cerrado: "vertical" (páginas de pie, lo común) u "horizontal"
     * (contenido girado para leerlo apaisado, como San Patricio). Por defecto "vertical".
     */
    orientacion?: "vertical" | "horizontal";
    etiquetas: string[];
  };
  fondoExterior: () => string;
  fondoInterior: () => string;
  /** Agrega los bloques. Los fondos se agregan solos (zIndex 1 de cada página). */
  armar: (a: Armador) => void;
};

export const archivoFondo = (slug: string, pagina: "exterior" | "interior") => `librito-${slug}-${pagina}.jpg`;
export const archivoMiniatura = (slug: string) => `librito-${slug}-miniatura.jpg`;
