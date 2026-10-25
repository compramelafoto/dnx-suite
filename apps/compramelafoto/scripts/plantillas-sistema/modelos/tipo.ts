import type { Armador, RolFoto } from "../lienzo";

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
  /**
   * Tercera página: la plancha de figuritas para imprimir en papel autoadhesivo y recortar (sólo
   * los álbumes de figuritas). Se imprime plana: no tiene doblez.
   */
  fondoPlancha?: () => string;
  /** Agrega los bloques. Los fondos se agregan solos (zIndex 1 de cada página). */
  armar: (a: Armador) => void;
  /**
   * Otro nombre para alguna foto que se le pide a la familia (va a `metaJson.photoInputs` y lo
   * muestra el canje). Por ejemplo `{ maestra: "Foto con la catequista" }`.
   */
  etiquetasDeFotos?: Partial<Record<RolFoto, string>>;
  /** Tanda a la que pertenece, para generar sólo esa con `--serie=<nombre>` (con su SQL). */
  serie?: string;
};

/** Categorías del catálogo. */
export const CATEGORIAS = ["Jardín", "Primaria", "Secundaria", "Egresados", "Formal", "Informal", "Religioso"] as const;

export const archivoFondo = (slug: string, pagina: "exterior" | "interior" | "plancha") => `librito-${slug}-${pagina}.jpg`;
export const archivoMiniatura = (slug: string) => `librito-${slug}-miniatura.jpg`;
