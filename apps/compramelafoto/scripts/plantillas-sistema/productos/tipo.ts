import type { Armador, RolFoto } from "../lienzo";
import type { Formato, Hoja } from "./hoja";

/** El tipo de producto, como lo muestra el filtro del catálogo. */
export type TipoDeProducto =
  | "Diploma"
  | "Calendario"
  | "Anuario"
  | "Álbum de figuritas"
  | "Señalador"
  | "Portarretrato"
  | "Tarjeta"
  | "Póster del curso";

/** Para los ids y los nombres de archivo: `sys_<prefijo>_<slug>`. */
export const PREFIJO: Record<TipoDeProducto, string> = {
  Diploma: "diploma",
  Calendario: "calendario",
  Anuario: "anuario",
  "Álbum de figuritas": "figuritas",
  Señalador: "senalador",
  Portarretrato: "portarretrato",
  Tarjeta: "tarjeta",
  "Póster del curso": "poster",
};

export type EstiloDeCatalogo = "Formal" | "Informal" | "Divertido" | "Moderno" | "Clásico" | "Minimalista";

/** Un producto plano (no se dobla): una o más hojas, cada una con su fondo y sus bloques. */
export type ModeloProducto = {
  tipo: TipoDeProducto;
  /** Parte estable de los ids y de los archivos. No cambiar una vez cargado. */
  slug: string;
  nombre: string;
  descripcion: string;
  /** Jardín, Primaria, Secundaria, Egresados, Formal, Informal o Religioso. */
  categoria: string;
  estilo: EstiloDeCatalogo;
  evento?: string;
  etiquetas: string[];
  formato: Formato;
  /** Las hojas en orden: su nombre (lo ve el fotógrafo en el editor) y su fondo. */
  hojas: Array<{ nombre: string; fondo: (h: Hoja) => string }>;
  armar: (a: Armador, h: Hoja) => void;
  /** Otro nombre para alguna foto que se le pide a la familia. */
  etiquetasDeFotos?: Partial<Record<RolFoto, string>>;
  /** Tanda, para generar sólo esa con `--serie=<nombre>`. */
  serie: string;
};
