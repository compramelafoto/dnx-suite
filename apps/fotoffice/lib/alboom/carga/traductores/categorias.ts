import { DUDAS, MOTIVOS, actualizarOIgual, huellasDe, porMapa } from "../campos";
import { campos, clave, siNo, texto } from "../normalizar";
import type { Campos, Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Categorías de oportunidad de Alboom (`/categories?type=lead_type`, la extracción las guarda como
 * "lead_type/<id>") → `FotofficeConsultaCategoria` con su grupo.
 *
 * - Los nombres que Alboom dejó en portugués se unifican al castellano (`NOMBRES_EN_PORTUGUES`).
 * - Se emparejan por nombre normalizado con las que ya existen (DNX tiene las 21 sembradas) y, si no, con sus
 *   equivalentes conocidas (`EQUIVALENTES`): "15 anos" → "Fiesta 15 Años" → "Fotografía o Video de Cumpleaños de 15".
 * - Lo que no empareja se crea (archivada si en Alboom estaba inactiva).
 * - De una existente sólo se completa el grupo si está vacío: nunca se pisa (si es otro, conflicto).
 *
 * Grupo (`subtype`, doc 05 §3.21): la forma real no está confirmada; se aceptan texto o número y, si no se
 * entiende, se deduce del nombre (con una duda).
 */

export const TIPO_CATEGORIA = "CONSULTA_CATEGORIA";
export const PREFIJO_CATEGORIA = "lead_type/";
export const MAX_NOMBRE_CATEGORIA = 100;

export type Grupo = "BODA" | "EVENTO" | "TRABAJO_CON_FECHA" | "TRABAJO_SIN_FECHA";

/** Nombre en portugués (clave normalizada) → nombre en castellano. Ajustable cuando se vean los datos reales. */
export const NOMBRES_EN_PORTUGUES: Record<string, string> = {
  "15 anos": "Fiesta 15 Años",
  "festa 15 anos": "Fiesta 15 Años",
  debutante: "Fiesta 15 Años",
  casamento: "Boda",
  ensaio: "Sesión de Fotos",
  "ensaio fotografico": "Sesión de Fotos",
  aniversario: "Cumpleaños",
  "aniversario infantil": "Cumpleaños Infantil",
  familia: "Familia",
  "pre casamento": "Pre Boda",
  "pre wedding": "Pre Boda",
  batizado: "Bautismo",
  formatura: "Graduación",
  gestante: "Sesión de Embarazo",
  "evento corporativo": "Evento Corporativo",
};

/** Nombre unificado (clave) → otros nombres con que puede existir ya en FOTOFFICE (DNX y semillas genéricas). */
export const EQUIVALENTES: Record<string, string[]> = {
  "fiesta 15 anos": ["Fotografía o Video de Cumpleaños de 15", "XV", "15 años", "Fiesta de 15", "Quince años"],
  cumpleanos: ["Cumpleaños Infantiles/adultos", "Cumpleaños adulto", "Cumpleaños de adultos"],
  "cumpleanos infantil": ["Infantil", "Cumpleaños infantiles"],
  "sesion de fotos": ["Sesión fotográfica", "Sesion fotografica"],
  boda: ["Casamiento"],
  "pre boda": ["Preboda", "Pre casamiento", "Precasamiento"],
  bautismo: ["Evento religioso", "Bautismo / Comunión"],
  graduacion: ["Egresados"],
};

const GRUPOS_TEXTO: Record<string, Grupo> = {
  boda: "BODA",
  wedding: "BODA",
  casamento: "BODA",
  casamiento: "BODA",
  evento: "EVENTO",
  event: "EVENTO",
  "trabajo con fecha": "TRABAJO_CON_FECHA",
  "job with date": "TRABAJO_CON_FECHA",
  "trabalho com data": "TRABAJO_CON_FECHA",
  "trabajo sin fecha": "TRABAJO_SIN_FECHA",
  "job without date": "TRABAJO_SIN_FECHA",
  "trabalho sem data": "TRABAJO_SIN_FECHA",
  job: "TRABAJO_SIN_FECHA",
};

/** Nombre de Alboom → nombre unificado en castellano. */
export function unificarNombre(nombre: string): string {
  return NOMBRES_EN_PORTUGUES[clave(nombre)] ?? nombre;
}

export function grupoDeAlboom(p: Record<string, unknown>): Grupo | null {
  for (const k of ["subtype_name", "group", "subtype", "category_subtype"]) {
    const t = texto(p[k]);
    if (!t) continue;
    const g = GRUPOS_TEXTO[clave(t)] ?? (["BODA", "EVENTO", "TRABAJO_CON_FECHA", "TRABAJO_SIN_FECHA"].includes(t.toUpperCase()) ? (t.toUpperCase() as Grupo) : null);
    if (g) return g;
  }
  return null;
}

/** Si el grupo no se entiende, se deduce del nombre. */
export function grupoPorNombre(nombre: string): Grupo {
  const k = ` ${clave(nombre)} `;
  if (/ (boda|casamiento|casamento) /.test(k)) return "BODA";
  if (/ (15|xv|quince|cumpleanos|bautismo|comunion|graduacion|evento|fiesta|casamiento) /.test(k)) return "EVENTO";
  return "TRABAJO_SIN_FECHA";
}

export type CategoriaExistente = { id: string; name: string; group: string };

export type CtxCategorias = {
  categorias: CategoriaExistente[];
  ordenBase: number;
  mapa: Map<string, EntradaMapa>;
};

function buscar(ctx: CtxCategorias, original: string, unificado: string): CategoriaExistente | undefined {
  const candidatas = [original, unificado, ...(EQUIVALENTES[clave(unificado)] ?? [])].map(clave);
  for (const k of candidatas) {
    const c = ctx.categorias.find((x) => clave(x.name) === k);
    if (c) return c;
  }
  return undefined;
}

export function traducirCategoria(c: Crudo, ctx: CtxCategorias): Decision {
  if (!c.alboomId.startsWith(PREFIJO_CATEGORIA)) return { accion: "OMITIR", motivo: MOTIVOS.noEsCategoriaDeConsulta };
  const mapa = ctx.mapa.get(c.alboomId);
  const ya = porMapa(c, mapa, (id) => ctx.categorias.some((x) => x.id === id));
  if (ya) return ya;
  const p = campos(c.payload);
  const original = texto(p.name, 1000);
  if (!original) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  const unificado = unificarNombre(original);
  const name = unificado.slice(0, MAX_NOMBRE_CATEGORIA).trim();
  const dudas: string[] = [];
  if (unificado.length > MAX_NOMBRE_CATEGORIA) dudas.push(DUDAS.nombreLargo);
  let group = grupoDeAlboom(p);

  const existente = mapa ? ctx.categorias.find((x) => x.id === mapa.targetId) : buscar(ctx, original, unificado);
  if (existente) {
    // El grupo de una existente no se deduce del nombre: si Alboom no lo dice, queda el de FOTOFFICE.
    const nuevos: Campos = group ? { group } : {};
    return actualizarOIgual(existente.id, nuevos, { group: existente.group }, mapa, dudas.length ? { dudas } : {});
  }
  if (!group) {
    group = grupoPorNombre(name);
    dudas.push(DUDAS.grupoDesconocido);
  }
  const activa = siNo(p.active) !== false;
  return {
    accion: "CREAR",
    datos: { name, group, archivada: !activa, order: ctx.ordenBase + ctx.categorias.length },
    huellas: huellasDe({ group }),
    ...(dudas.length ? { dudas } : {}),
  };
}

export function registrarCategoria(ctx: CtxCategorias, d: Decision, targetId: string): void {
  if (d.accion === "CREAR" && typeof d.datos?.name === "string") {
    ctx.categorias.push({ id: targetId, name: d.datos.name, group: String(d.datos.group) });
  }
}
