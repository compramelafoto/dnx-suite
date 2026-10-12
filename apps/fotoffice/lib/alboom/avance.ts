import { ENTIDADES } from "./entidades";

/**
 * Forma del avance de una extracción (`FotofficeAlboomExtraccion.progress`). Puro: sin base ni `node:*`, para que
 * lo usen el extractor, la pantalla y las pruebas.
 *
 * Sólo cuenta cosas: nunca guarda datos de Alboom (ni nombres ni correos), así se puede mostrar entero.
 */

export type EstadoEntidad = "PENDIENTE" | "EN_CURSO" | "LISTA" | "ERROR" | "NO_DISPONIBLE";

export type AvanceEntidad = {
  estado: EstadoEntidad;
  /** Pedidos hechos a Alboom para esta entidad. */
  paginas: number;
  /** Registros vistos en esta extracción. */
  cantidad: number;
  nuevos: number;
  cambiados: number;
  iguales: number;
  errores: number;
  /** Cosas que no cerraron con lo documentado (registro sin id, forma desconocida). Sólo cantidades. */
  dudas: number;
  /** Cursor para retomar. Página (listados, desde 1) o desplazamiento (`porDesplazamiento`). */
  pagina?: number;
  /** Índice del próximo pedido en las fuentes `varias`. */
  sub?: number;
  /** Último padre terminado (fuentes `porPadre` y `derivada`). */
  padre?: string | null;
  /** Desplazamiento dentro del padre en curso. */
  offset?: number;
  /** Ids de la página anterior (sólo `porDesplazamiento`), para frenar si Alboom repite la misma página. */
  huellaPagina?: string;
  /** Mensaje legible del último error. Nunca lleva datos de la cuenta ni de clientes. */
  ultimoError?: string;
  /** ISO. */
  actualizado?: string;
};

export type Avance = {
  version: 1;
  entidades: Record<string, AvanceEntidad>;
  /** Pedidos a Alboom en toda la extracción (sin contar los inicios de sesión). */
  pedidos: number;
  /** Fallas transitorias seguidas (429, 5xx, red). Vuelve a 0 con el primer pedido bueno. */
  reintentos: number;
  /** ISO: antes de esta hora el cron no la retoma (espera por 429/5xx). */
  reintentarDesde: string | null;
};

export function avanceEntidadInicial(): AvanceEntidad {
  return { estado: "PENDIENTE", paginas: 0, cantidad: 0, nuevos: 0, cambiados: 0, iguales: 0, errores: 0, dudas: 0 };
}

export function avanceInicial(): Avance {
  const entidades: Record<string, AvanceEntidad> = {};
  for (const e of ENTIDADES) {
    entidades[e.clave] = e.fuente.tipo === "noDisponible" ? { ...avanceEntidadInicial(), estado: "NO_DISPONIBLE", ultimoError: e.fuente.motivo } : avanceEntidadInicial();
  }
  return { version: 1, entidades, pedidos: 0, reintentos: 0, reintentarDesde: null };
}

function numero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

const ESTADOS: readonly EstadoEntidad[] = ["PENDIENTE", "EN_CURSO", "LISTA", "ERROR", "NO_DISPONIBLE"];

/** Lee el JSON de la base con tolerancia: lo que falte o no tenga forma vuelve al valor inicial. */
export function leerAvance(json: unknown): Avance {
  const base = avanceInicial();
  if (typeof json !== "object" || json === null) return base;
  const j = json as Record<string, unknown>;
  const entidades = (typeof j.entidades === "object" && j.entidades !== null ? j.entidades : {}) as Record<string, unknown>;
  for (const clave of Object.keys(base.entidades)) {
    const e = entidades[clave];
    if (typeof e !== "object" || e === null) continue;
    const r = e as Record<string, unknown>;
    const previo = base.entidades[clave]!;
    base.entidades[clave] = {
      estado: ESTADOS.includes(r.estado as EstadoEntidad) ? (r.estado as EstadoEntidad) : previo.estado,
      paginas: numero(r.paginas),
      cantidad: numero(r.cantidad),
      nuevos: numero(r.nuevos),
      cambiados: numero(r.cambiados),
      iguales: numero(r.iguales),
      errores: numero(r.errores),
      dudas: numero(r.dudas),
      ...(typeof r.pagina === "number" ? { pagina: numero(r.pagina) } : {}),
      ...(typeof r.sub === "number" ? { sub: numero(r.sub) } : {}),
      ...(typeof r.padre === "string" || r.padre === null ? { padre: r.padre as string | null } : {}),
      ...(typeof r.offset === "number" ? { offset: numero(r.offset) } : {}),
      ...(typeof r.huellaPagina === "string" ? { huellaPagina: r.huellaPagina } : {}),
      ...(typeof r.ultimoError === "string" ? { ultimoError: r.ultimoError.slice(0, 300) } : previo.ultimoError ? { ultimoError: previo.ultimoError } : {}),
      ...(typeof r.actualizado === "string" ? { actualizado: r.actualizado } : {}),
    };
  }
  return {
    version: 1,
    entidades: base.entidades,
    pedidos: numero(j.pedidos),
    reintentos: numero(j.reintentos),
    reintentarDesde: typeof j.reintentarDesde === "string" ? j.reintentarDesde : null,
  };
}

export type ResumenAvance = { total: number; terminadas: number; conError: number; noDisponibles: number; registros: number; errores: number; dudas: number };

export function resumirAvance(a: Avance): ResumenAvance {
  const lista = Object.values(a.entidades);
  return {
    total: lista.length,
    terminadas: lista.filter((e) => e.estado === "LISTA" || e.estado === "ERROR" || e.estado === "NO_DISPONIBLE").length,
    conError: lista.filter((e) => e.estado === "ERROR").length,
    noDisponibles: lista.filter((e) => e.estado === "NO_DISPONIBLE").length,
    registros: lista.reduce((s, e) => s + e.cantidad, 0),
    errores: lista.reduce((s, e) => s + e.errores, 0),
    dudas: lista.reduce((s, e) => s + e.dudas, 0),
  };
}
