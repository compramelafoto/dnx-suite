/**
 * Rasgos de una plantilla para filtrar el catálogo: nivel, evento, estilo, orientación, cantidad
 * de fotos, si lleva listado del curso y si lleva logo, más etiquetas para el buscador.
 *
 * Las plantillas nuevas los traen en `metaJson`. Las que no (las primeras del sistema y las de
 * los fotógrafos) se deducen de los bloques: listado si algún bloque usa `course.studentList`,
 * logo si alguno usa `branding.schoolLogoUrl`, cantidad de fotos por las ranuras de foto
 * distintas (o `photoInputs`, la que sea mayor) y orientación vertical si no se sabe.
 *
 * Puro: lo usan la lista del catálogo (servidor) y los filtros (navegador).
 */

export type Orientacion = "vertical" | "horizontal";

export type RasgosDePlantilla = {
  categoria: string | null;
  estilo: string | null;
  orientacion: Orientacion;
  cantidadFotos: number;
  conListado: boolean;
  conLogo: boolean;
  evento: string | null;
  etiquetas: string[];
};

export type BloqueParaRasgos = { type: string; configJson?: unknown };

const LISTADO = "course.studentList";
const LOGO = "branding.schoolLogoUrl";
/** Ranuras de foto: `photo_<n>` y las que tienen nombre. */
const RANURA_DE_FOTO = /^photo_(\d+|individual|group|teacher|friends|extra)$/;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Las variables que usa un bloque: la del texto o la de la imagen (`source.variableKey`). */
function variablesDelBloque(b: BloqueParaRasgos): string[] {
  const c = asRecord(b.configJson);
  return [texto(c.variableKey), texto(asRecord(c.source).variableKey)].filter((k): k is string => k != null);
}

export function rasgosDePlantilla(input: {
  meta: unknown;
  blocks: BloqueParaRasgos[];
  /** Variables atadas por vínculo (`TemplateV2VariableBinding`), si se tienen. */
  bindingKeys?: string[];
}): RasgosDePlantilla {
  const meta = asRecord(input.meta);
  const claves = new Set<string>(input.bindingKeys ?? []);
  for (const b of input.blocks) for (const k of variablesDelBloque(b)) claves.add(k);

  const ranuras = new Set<string>();
  for (const b of input.blocks) {
    if (b.type !== "IMAGE" && b.type !== "PHOTO") continue;
    for (const k of variablesDelBloque(b)) if (RANURA_DE_FOTO.test(k)) ranuras.add(k);
  }
  const entradas = Array.isArray(meta.photoInputs) ? meta.photoInputs.length : 0;

  const orientacionMeta = texto(meta.orientacion)?.toLowerCase();
  const etiquetas = Array.isArray(meta.etiquetas)
    ? meta.etiquetas.map(texto).filter((t): t is string => t != null)
    : [];

  return {
    categoria: texto(meta.categoria),
    estilo: texto(meta.estilo),
    orientacion: orientacionMeta === "horizontal" ? "horizontal" : "vertical",
    cantidadFotos:
      typeof meta.cantidadFotos === "number" && Number.isFinite(meta.cantidadFotos) && meta.cantidadFotos >= 0
        ? Math.round(meta.cantidadFotos)
        : Math.max(ranuras.size, entradas),
    conListado: typeof meta.conListado === "boolean" ? meta.conListado : claves.has(LISTADO),
    conLogo: typeof meta.conLogo === "boolean" ? meta.conLogo : claves.has(LOGO),
    evento: texto(meta.evento),
    etiquetas,
  };
}

/* ---------------------------------- Filtros del catálogo ---------------------------------- */

export type SiNo = "" | "si" | "no";

export type FiltrosDeCatalogo = {
  texto: string;
  categoria: string;
  evento: string;
  estilo: string;
  orientacion: "" | Orientacion;
  /** Cantidad exacta de fotos, como texto ("" = todas). */
  cantidadFotos: string;
  listado: SiNo;
  logo: SiNo;
};

export const FILTROS_VACIOS: FiltrosDeCatalogo = {
  texto: "",
  categoria: "",
  evento: "",
  estilo: "",
  orientacion: "",
  cantidadFotos: "",
  listado: "",
  logo: "",
};

function normal(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function igual(a: string | null, b: string): boolean {
  return a != null && normal(a) === normal(b);
}

function cumpleSiNo(valor: boolean, filtro: SiNo): boolean {
  return filtro === "" || (filtro === "si") === valor;
}

/** Las plantillas que cumplen todos los filtros a la vez. El texto busca en nombre y etiquetas. */
export function filtrarPlantillas<T extends { name: string; rasgos: RasgosDePlantilla }>(
  items: T[],
  f: FiltrosDeCatalogo,
): T[] {
  const palabras = normal(f.texto).split(/\s+/).filter(Boolean);
  return items.filter(({ name, rasgos: r }) => {
    if (f.categoria && !igual(r.categoria, f.categoria)) return false;
    if (f.evento && !igual(r.evento, f.evento)) return false;
    if (f.estilo && !igual(r.estilo, f.estilo)) return false;
    if (f.orientacion && r.orientacion !== f.orientacion) return false;
    if (f.cantidadFotos && String(r.cantidadFotos) !== f.cantidadFotos) return false;
    if (!cumpleSiNo(r.conListado, f.listado)) return false;
    if (!cumpleSiNo(r.conLogo, f.logo)) return false;
    if (palabras.length) {
      const pajar = normal([name, ...r.etiquetas, r.categoria ?? "", r.evento ?? "", r.estilo ?? ""].join(" "));
      if (!palabras.every((p) => pajar.includes(p))) return false;
    }
    return true;
  });
}

const ORDEN_CATEGORIAS = ["Jardín", "Primaria", "Secundaria", "Egresados", "Formal", "Informal", "Religioso"];

function distintos(valores: Array<string | null>, orden: string[] = []): string[] {
  const vistos = new Map<string, string>();
  for (const v of valores) if (v && !vistos.has(normal(v))) vistos.set(normal(v), v);
  const pos = (s: string) => {
    const i = orden.findIndex((o) => normal(o) === normal(s));
    return i < 0 ? orden.length : i;
  };
  return [...vistos.values()].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, "es"));
}

/** Las opciones de cada filtro, sacadas de las plantillas que hay (sin opciones vacías). */
export function opcionesDeFiltros(items: Array<{ rasgos: RasgosDePlantilla }>) {
  const r = items.map((i) => i.rasgos);
  return {
    categorias: distintos(r.map((x) => x.categoria), ORDEN_CATEGORIAS),
    eventos: distintos(r.map((x) => x.evento)),
    estilos: distintos(r.map((x) => x.estilo)),
    orientaciones: [...new Set(r.map((x) => x.orientacion))].sort() as Orientacion[],
    cantidades: [...new Set(r.map((x) => x.cantidadFotos))].sort((a, b) => a - b),
  };
}

export function hayFiltros(f: FiltrosDeCatalogo): boolean {
  return Object.values(f).some((v) => v !== "");
}
