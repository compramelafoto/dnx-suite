import {
  FILAS_PERMITIDAS,
  PARAMETROS_RESERVADOS,
  type ConsultaListado,
  type DefinicionListado,
  type FilasPorPagina,
} from "./tipos";
import { esAtajoPeriodo, esRangoValido } from "./periodos";

const ID_RELACION = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BUSQUEDA = 100;
/** Parámetros que la pantalla usa para mensajes y no forman parte de la consulta. */
const IGNORADOS = new Set(["ok", "error", "forbidden", "module"]);

export { esRangoValido } from "./periodos";

export function consultaVacia(def: DefinicionListado<unknown>): ConsultaListado {
  return { q: "", filtros: {}, orden: { ...def.ordenPorDefecto }, pagina: 1, filas: 25, ver: null };
}

export function leerConsulta(
  def: DefinicionListado<unknown>,
  params: URLSearchParams,
): { consulta: ConsultaListado; descartados: string[] } {
  const consulta = consultaVacia(def);
  const descartados: string[] = [];
  const filtrosPorClave = new Map(def.filtros.map((f) => [f.clave, f]));

  for (const [clave, crudo] of params.entries()) {
    const valor = crudo.trim();
    if (IGNORADOS.has(clave) || clave === "limpio" || clave === "vista") continue;
    if (clave === "q") {
      consulta.q = valor.slice(0, MAX_BUSQUEDA);
      continue;
    }
    if (clave === "orden") {
      const desc = valor.startsWith("-");
      const campo = desc ? valor.slice(1) : valor;
      if (def.ordenes.includes(campo)) consulta.orden = { campo, desc };
      else descartados.push(clave);
      continue;
    }
    if (clave === "pagina") {
      const n = Number(valor);
      if (Number.isInteger(n) && n >= 1) consulta.pagina = n;
      else descartados.push(clave);
      continue;
    }
    if (clave === "filas") {
      const n = Number(valor) as FilasPorPagina;
      if ((FILAS_PERMITIDAS as readonly number[]).includes(n)) consulta.filas = n;
      else descartados.push(clave);
      continue;
    }
    if (clave === "ver") {
      if (ID_RELACION.test(valor)) consulta.ver = valor;
      continue;
    }
    const filtro = filtrosPorClave.get(clave);
    if (!filtro || valor === "") {
      if (valor !== "") descartados.push(clave);
      continue;
    }
    const ok =
      (filtro.tipo === "opcion" && filtro.opciones.some((o) => o.valor === valor)) ||
      (filtro.tipo === "relacion" && ID_RELACION.test(valor)) ||
      (filtro.tipo === "periodo" && (esAtajoPeriodo(valor) || esRangoValido(valor))) ||
      (filtro.tipo === "siNo" && (valor === "si" || valor === "no"));
    if (ok) consulta.filtros[clave] = valor;
    else descartados.push(clave);
  }
  return { consulta, descartados };
}

export type CambiosConsulta = {
  q?: string;
  filtros?: Record<string, string | null>;
  orden?: { campo: string; desc: boolean };
  pagina?: number;
  filas?: FilasPorPagina;
  ver?: string | null;
};

/** Devuelve la query string (sin "?"). Cambiar búsqueda, filtros, orden o filas vuelve a la página 1. */
export function escribirConsulta(
  def: DefinicionListado<unknown>,
  consulta: ConsultaListado,
  cambios: CambiosConsulta = {},
): string {
  const reinicia = cambios.q !== undefined || cambios.filtros || cambios.orden || cambios.filas;
  const filtros = { ...consulta.filtros };
  for (const [k, v] of Object.entries(cambios.filtros ?? {})) {
    if (v === null || v === "") delete filtros[k];
    else filtros[k] = v;
  }
  const q = cambios.q ?? consulta.q;
  const orden = cambios.orden ?? consulta.orden;
  const filas = cambios.filas ?? consulta.filas;
  const pagina = reinicia ? 1 : (cambios.pagina ?? consulta.pagina);
  const ver = cambios.ver === undefined ? consulta.ver : cambios.ver;

  const out = new URLSearchParams();
  if (q) out.set("q", q);
  for (const f of def.filtros) if (filtros[f.clave]) out.set(f.clave, filtros[f.clave]);
  const esDefecto = orden.campo === def.ordenPorDefecto.campo && orden.desc === def.ordenPorDefecto.desc;
  if (!esDefecto) out.set("orden", `${orden.desc ? "-" : ""}${orden.campo}`);
  if (pagina > 1) out.set("pagina", String(pagina));
  if (filas !== 25) out.set("filas", String(filas));
  if (ver) out.set("ver", ver);
  return out.toString();
}

export function hayConsultaEnDireccion(params: URLSearchParams): boolean {
  for (const clave of params.keys()) if (!IGNORADOS.has(clave)) return true;
  return false;
}

export { PARAMETROS_RESERVADOS };
