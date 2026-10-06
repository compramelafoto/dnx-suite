import type { ReactNode } from "react";
import type { AccesoEfectivo, Capacidad } from "@/lib/access/policy";

export const FILAS_PERMITIDAS = [10, 25, 50, 100] as const;
export type FilasPorPagina = (typeof FILAS_PERMITIDAS)[number];

/** Parámetros de la dirección que ninguna definición puede usar como clave de filtro. */
export const PARAMETROS_RESERVADOS = ["q", "orden", "pagina", "filas", "ver", "limpio", "vista"] as const;

export type Opcion = { valor: string; etiqueta: string };

export type FiltroDef =
  | { tipo: "opcion"; clave: string; etiqueta: string; opciones: readonly Opcion[] }
  /** Id de otra tabla (categoría, cuenta, cliente). Se valida contra el workspace en `ejecutar`. */
  | { tipo: "relacion"; clave: string; etiqueta: string; conBuscador?: boolean }
  | { tipo: "periodo"; clave: string; etiqueta: string }
  | { tipo: "siNo"; clave: string; etiqueta: string; si: string; no: string };

export type ConsultaListado = {
  q: string;
  /** clave de filtro → valor crudo ya validado en forma (no en existencia). */
  filtros: Record<string, string>;
  orden: { campo: string; desc: boolean };
  pagina: number;
  filas: FilasPorPagina;
  ver: string | null;
};

export type RangoFechas = { desde: Date; hasta: Date };

/** La consulta después de validar relaciones y resolver períodos. Es lo que reciben `contar`/`traer`. */
export type ConsultaResuelta = ConsultaListado & {
  periodos: Record<string, RangoFechas>;
  /** clave de filtro de relación → etiqueta legible (para los chips). */
  etiquetasRelacion: Record<string, string>;
  /**
   * Lo que suman los campos personalizados (lo pone `conCampos`, de `lib/campos/listado`), ya
   * resuelto con subconsultas acotadas al workspace: `soloIds` acota el resultado (AND) y
   * `buscarIds` se suma como una alternativa más al OR de la búsqueda general.
   */
  campos?: RestriccionCampos;
};

export type RestriccionCampos = { soloIds: string[] | null; buscarIds: string[] };

export type ContextoListado = {
  workspaceId: string;
  workspaceName: string;
  userId: number;
  userLabel: string;
  role: string | null;
  /** Acceso efectivo (modelo de main). Siempre presente en producción; las pruebas pueden omitirlo. */
  acceso?: AccesoEfectivo;
  /** Módulo de la lista: sobre él se miden `operar` y `ver`. */
  modulo?: string;
};

export type ColumnaDef<F> = {
  clave: string;
  titulo: string;
  celda: (fila: F) => ReactNode;
  /** Si está, la columna se ordena por este campo (debe figurar en `ordenes`). */
  orden?: string;
  /** Se esconde cuando el panel lateral está abierto y en pantallas chicas. */
  secundaria?: boolean;
  alinear?: "izquierda" | "derecha";
};

export type ColumnaExport<F> = {
  titulo: string;
  tipo: "texto" | "importe" | "fecha" | "fechaHora" | "numero";
  valor: (fila: F) => string | number | Date | null;
};

export type ResultadoLote = {
  aplicados: number;
  fallidos: { id: string; error: string }[];
  /** Antes/después por fila, para `FotofficeListActivity.detail`. */
  detalle: unknown[];
};

export type AccionLote = {
  clave: string;
  etiqueta: string;
  capacidad: Capacidad;
  maximo: number;
  /** Texto de confirmación. `{n}` = cantidad, `{parametro}` = etiqueta del parámetro elegido. */
  confirmacion: string;
  parametro?: { etiqueta: string; opciones: (ctx: ContextoListado) => Promise<Opcion[]> };
  /** Separa las filas que la acción no puede tocar, con el motivo. */
  elegibles?: (
    ctx: ContextoListado,
    ids: string[],
    parametro: string | null,
  ) => Promise<{ elegibles: string[]; excluidos: { id: string; motivo: string }[] }>;
  aplicar: (ctx: ContextoListado, ids: string[], parametro: string | null) => Promise<ResultadoLote>;
};

export type DefinicionListado<F> = {
  clave: string;
  titulo: string;
  /** Singular y plural para "Mostrando 1 a 25 de 40 {plural}". */
  sustantivo: { singular: string; plural: string };
  placeholderBusqueda: string;
  columnas: ColumnaDef<F>[];
  filtros: FiltroDef[];
  ordenes: readonly string[];
  ordenPorDefecto: { campo: string; desc: boolean };
  idDe: (fila: F) => string;
  hrefFicha: (id: string) => string;
  contar: (ctx: ContextoListado, c: ConsultaResuelta) => Promise<number>;
  traer: (ctx: ContextoListado, c: ConsultaResuelta, p: { skip: number; take: number }) => Promise<F[]>;
  /** Ids del resultado completo, en orden, hasta `tope`. Para "todos los resultados" y exportar. */
  traerIds: (ctx: ContextoListado, c: ConsultaResuelta, tope: number) => Promise<string[]>;
  /** Filas completas por id (exportar selección). Debe filtrar por workspaceId. */
  traerPorIds: (ctx: ContextoListado, ids: string[]) => Promise<F[]>;
  /** Devuelve la etiqueta si el id existe en el workspace, o null. */
  validarRelacion?: (ctx: ContextoListado, clave: string, id: string) => Promise<string | null>;
  opcionesRelacion?: (ctx: ContextoListado, clave: string) => Promise<Opcion[]>;
  buscarRelacion?: (ctx: ContextoListado, clave: string, texto: string) => Promise<Opcion[]>;
  /** Aviso opcional sobre la consulta resuelta (p. ej. un filtro que no se pudo aplicar entero). */
  aviso?: (ctx: ContextoListado, c: ConsultaResuelta) => Promise<string | null>;
  acciones: AccionLote[];
  exportar: { columnas: ColumnaExport<F>[] };
  panel?: (ctx: ContextoListado, id: string) => Promise<ReactNode | null>;
};
