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
  /** Filas recibidas en los listados paginados (para comparar con el `count` de Alboom). */
  leidas?: number;
  /** Índice del próximo pedido en las fuentes `varias`. */
  sub?: number;
  /** Último padre terminado (fuentes `porPadre` y `derivada`). */
  padre?: string | null;
  /** Desplazamiento dentro del padre en curso. */
  offset?: number;
  /** Firma de la página anterior, para frenar si Alboom repite la misma página. */
  huellaPagina?: string;
  /** Pedidos buenos a Alboom en esta entidad (fuentes `porPadre`): distingue "endpoint roto" de "algunos fallan". */
  exitos?: number;
  /** Registros hijos seguidos que fallaron (fuentes `porPadre`). Vuelve a 0 con el primer pedido bueno. */
  fallasSeguidas?: number;
  /** Versión de la forma de pedir con la que se recorrió (ver `Entidad.version`). Sin dato = 1. */
  version?: number;
  /**
   * Listados paginados: desplazamiento absoluto (en filas) de la próxima página. Manda sobre `pagina`, que queda
   * como dato para la pantalla. Sin dato (avance viejo) sale de `pagina`.
   */
  desde?: number;
  /**
   * Listados paginados: tramos con páginas más chicas porque una página dio 5xx (25 → 5 → 1). Una pila: el último
   * manda hasta llegar a su `hasta` (desplazamiento donde termina la página que falló).
   */
  tramos?: { tamano: number; hasta: number }[];
  /** Listados paginados: filas salteadas porque Alboom dio 5xx incluso pidiéndolas de a una. */
  saltados?: number;
  /** Desplazamientos de esas filas (sin datos de la cuenta), hasta `MAX_SALTADAS`. */
  filasSalteadas?: number[];
  /** Listados paginados: el último `count` que informó Alboom. */
  total?: number;
  /**
   * Entidades que son padre de otras (`porPadre`): ids nuevos o cambiados de huella EN ESTA extracción, hasta
   * `MAX_TOCADOS`. Con eso, "Volver a extraer" pide los hijos sólo de lo que cambió. Sin dato = no se sabe.
   */
  tocados?: string[];
  /** Hubo más de `MAX_TOCADOS` (o no se pudo saber): los hijos se piden de todos los padres. */
  tocadosDesbordado?: boolean;
  /** Hijos (`porPadre`): padres cuyo pedido falló en esta extracción, hasta `MAX_FALLIDOS`. */
  fallidos?: string[];
  fallidosDesbordado?: boolean;
  /** Hijos (`porPadre`) en "Volver a extraer": padres sin cambios que no se volvieron a pedir. */
  salteados?: number;
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

/** Topes de las listas del avance, para que el JSON no crezca sin límite. */
export const MAX_TOCADOS = 1000;
export const MAX_FALLIDOS = 500;
export const MAX_SALTADAS = 100;

export function avanceEntidadInicial(): AvanceEntidad {
  return { estado: "PENDIENTE", paginas: 0, cantidad: 0, nuevos: 0, cambiados: 0, iguales: 0, errores: 0, dudas: 0 };
}

export function avanceInicial(): Avance {
  const entidades: Record<string, AvanceEntidad> = {};
  for (const e of ENTIDADES) {
    const inicial = { ...avanceEntidadInicial(), ...(e.version !== undefined ? { version: e.version } : {}) };
    entidades[e.clave] = e.fuente.tipo === "noDisponible" ? { ...inicial, estado: "NO_DISPONIBLE", ultimoError: e.fuente.motivo } : inicial;
  }
  return { version: 1, entidades, pedidos: 0, reintentos: 0, reintentarDesde: null };
}

function textos(v: unknown, max: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 200).slice(0, max);
}

function tramos(v: unknown): { tamano: number; hasta: number }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const r = v
    .filter((t): t is { tamano: number; hasta: number } => typeof t === "object" && t !== null && typeof t.tamano === "number" && typeof t.hasta === "number")
    .map((t) => ({ tamano: Math.max(1, numero(t.tamano)), hasta: numero(t.hasta) }))
    .slice(0, 5);
  return r.length > 0 ? r : undefined;
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
      ...(typeof r.leidas === "number" ? { leidas: numero(r.leidas) } : {}),
      ...(typeof r.sub === "number" ? { sub: numero(r.sub) } : {}),
      ...(typeof r.padre === "string" || r.padre === null ? { padre: r.padre as string | null } : {}),
      ...(typeof r.offset === "number" ? { offset: numero(r.offset) } : {}),
      ...(typeof r.huellaPagina === "string" ? { huellaPagina: r.huellaPagina } : {}),
      ...(typeof r.exitos === "number" ? { exitos: numero(r.exitos) } : {}),
      ...(typeof r.fallasSeguidas === "number" ? { fallasSeguidas: numero(r.fallasSeguidas) } : {}),
      // Sin `version` guardada es la 1 (avances anteriores a este campo), aunque el catálogo ya esté en otra.
      ...(typeof r.version === "number" ? { version: numero(r.version) } : {}),
      // Campos nuevos (oct. 2026): opcionales, un avance viejo sin ellos se lee igual.
      ...(typeof r.desde === "number" ? { desde: numero(r.desde) } : {}),
      ...(tramos(r.tramos) ? { tramos: tramos(r.tramos) } : {}),
      ...(typeof r.saltados === "number" ? { saltados: numero(r.saltados) } : {}),
      ...(Array.isArray(r.filasSalteadas)
        ? { filasSalteadas: r.filasSalteadas.filter((x): x is number => typeof x === "number").map(numero).slice(0, MAX_SALTADAS) }
        : {}),
      ...(typeof r.total === "number" ? { total: numero(r.total) } : {}),
      ...(textos(r.tocados, MAX_TOCADOS) ? { tocados: textos(r.tocados, MAX_TOCADOS) } : {}),
      ...(r.tocadosDesbordado === true ? { tocadosDesbordado: true } : {}),
      ...(textos(r.fallidos, MAX_FALLIDOS) ? { fallidos: textos(r.fallidos, MAX_FALLIDOS) } : {}),
      ...(r.fallidosDesbordado === true ? { fallidosDesbordado: true } : {}),
      ...(typeof r.salteados === "number" ? { salteados: numero(r.salteados) } : {}),
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
