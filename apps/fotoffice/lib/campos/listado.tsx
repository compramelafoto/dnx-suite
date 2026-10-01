import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import {
  PARAMETROS_RESERVADOS,
  type ColumnaDef,
  type ColumnaExport,
  type ConsultaResuelta,
  type ContextoListado,
  type DefinicionListado,
  type FiltroDef,
  type RangoFechas,
  type RestriccionCampos,
} from "@/lib/listado/tipos";
import type { TipoCampo, TipoRegistroActivo } from "./constantes";
import { listarCampos, type CampoDefinido } from "./definiciones";
import { textoLegible } from "./validacion";
import { valoresDe, type ValorGuardado } from "./valores";
import { hrefSeguro } from "./vista";

/**
 * Los campos personalizados en los listados estándar (0.2), al estilo de
 * `lib/ficha/etiquetas-listado.tsx`: columnas secundarias, filtros `cf_<clave>`, búsqueda y
 * exportación. Como los registros no tienen relación con `FotofficeCustomValue` (es polimórfica),
 * filtros y búsqueda se resuelven con una subconsulta previa de `entityId` acotada al workspace
 * de la sesión, que viaja como `id IN (...)` a la consulta principal. Pasado el tope la lista
 * sale vacía con un aviso (nunca parcial), como en Captación (0.4).
 */

/** Prefijo de las claves de filtro y de columna. Ninguna clave del motor ni de las listas empieza así. */
export const PREFIJO_CAMPO = "cf_";

/** Ids que puede devolver cada subconsulta (cada id viaja como parámetro del `IN`). */
export const TOPE_SUBCONSULTA_CAMPOS = 20_000;

/** Los tipos cuyo valor entra en la búsqueda general. */
const TIPOS_BUSCABLES: readonly TipoCampo[] = ["TEXTO", "TEXTO_LARGO", "ENLACE"];

/** Lo que `conCampos` le cuelga a cada fila: fieldId → valor guardado. */
export type ConCampos = { valoresCampos?: Map<string, ValorGuardado> };

export type CamposDeListado = {
  entityType: TipoRegistroActivo;
  /** Campos activos del workspace para ese tipo de registro, por orden. */
  campos: CampoDefinido[];
  /** Columnas secundarias de los campos con "mostrar en el listado". */
  columnas: ColumnaDef<ConCampos>[];
  /** Lista → opción; Sí/No → siNo; Fecha → período. Número, textos y enlace no filtran. */
  filtros: FiltroDef[];
  /** Todos los campos activos, como texto legible. */
  columnasExport: ColumnaExport<ConCampos>[];
  /** Ids de registros cuyo texto o enlace contiene `q`; null si son más que el tope. */
  condicionBusqueda: (q: string) => Promise<string[] | null>;
  /** Lo que la consulta pide a los campos (filtros y búsqueda); `excedido` si alguna superó el tope. */
  restriccion: (c: ConsultaResuelta) => Promise<RestriccionCampos & { excedido: boolean }>;
  /** Valores de una página entera, en una sola consulta. */
  cargarValores: (ids: string[]) => Promise<Map<string, Map<string, ValorGuardado>>>;
};

export const claveDeFiltro = (campo: Pick<CampoDefinido, "key">) => `${PREFIJO_CAMPO}${campo.key}`;

export function avisoDeCampos(plural: string): string {
  return `Hay más de ${TOPE_SUBCONSULTA_CAMPOS.toLocaleString("es-AR")} coincidencias en los campos personalizados de ${plural}: acotá la búsqueda o sumá otro filtro.`;
}

/** Puro: el filtro del motor para un campo, o null si su tipo no filtra. */
export function filtroDeCampo(campo: CampoDefinido): FiltroDef | null {
  const clave = claveDeFiltro(campo);
  switch (campo.type) {
    case "LISTA":
      if (campo.opciones.length === 0) return null;
      return { tipo: "opcion", clave, etiqueta: campo.name, opciones: campo.opciones.map((o) => ({ valor: o.id, etiqueta: o.label })) };
    case "SI_NO":
      return { tipo: "siNo", clave, etiqueta: campo.name, si: "Sí", no: "No" };
    case "FECHA":
      return { tipo: "periodo", clave, etiqueta: campo.name };
    default:
      return null;
  }
}

/** Fecha de calendario (medianoche UTC, como se guarda) del día argentino de `d`. */
const diaGuardado = (d: Date) => new Date(`${hoyEnBuenosAires(d)}T00:00:00.000Z`);

/**
 * Puro: la condición sobre `FotofficeCustomValue` que expresa el valor de un filtro de campo, o
 * null si el valor no aplica. Las fechas se guardan como día de calendario (medianoche UTC): el
 * período, resuelto en hora argentina, se pasa a días antes de comparar.
 */
export function condicionDeFiltro(
  campo: CampoDefinido,
  valor: string,
  periodo: RangoFechas | undefined,
): Prisma.FotofficeCustomValueWhereInput | null {
  switch (campo.type) {
    case "LISTA":
      return campo.opciones.some((o) => o.id === valor) ? { optionId: valor } : null;
    case "SI_NO":
      return valor === "si" ? { valueBool: true } : valor === "no" ? { valueBool: false } : null;
    case "FECHA":
      return periodo ? { valueDate: { gte: diaGuardado(periodo.desde), lte: diaGuardado(periodo.hasta) } } : null;
    default:
      return null;
  }
}

function CeldaCampo({ campo, valor }: { campo: CampoDefinido; valor: ValorGuardado | null }) {
  const legible = textoLegible(campo.type, valor, campo.etiquetas);
  if (!legible) return <span className="text-[var(--fo-muted)]">—</span>;
  if (campo.type === "ENLACE") {
    const href = hrefSeguro(valor?.texto);
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block max-w-xs truncate text-[var(--fo-accent)] hover:underline">
          {legible}
        </a>
      );
    }
  }
  if (campo.type === "TEXTO_LARGO") return <span className="line-clamp-2 block max-w-xs whitespace-pre-line">{legible}</span>;
  return <>{legible}</>;
}

const valorDe = (f: ConCampos, campo: CampoDefinido) => f.valoresCampos?.get(campo.id) ?? null;

/** Puro: columnas, filtros y exportación a partir de las definiciones activas. */
export function armarCampos(campos: CampoDefinido[]) {
  const activos = campos.filter((c) => c.archivedAt === null);
  const columnas: ColumnaDef<ConCampos>[] = activos
    .filter((c) => c.showInList)
    .map((campo) => ({
      clave: claveDeFiltro(campo),
      titulo: campo.name,
      secundaria: true,
      alinear: campo.type === "NUMERO" ? "derecha" : undefined,
      celda: (f: ConCampos) => <CeldaCampo campo={campo} valor={valorDe(f, campo)} />,
    }));
  const filtros = activos.flatMap((c) => filtroDeCampo(c) ?? []);
  const columnasExport: ColumnaExport<ConCampos>[] = activos.map((campo) => ({
    titulo: campo.name,
    tipo: "texto",
    valor: (f: ConCampos) => textoLegible(campo.type, valorDe(f, campo), campo.etiquetas) || null,
  }));
  return { activos, columnas, filtros, columnasExport };
}

async function idsQueCumplen(
  ctx: ContextoListado,
  entityType: TipoRegistroActivo,
  where: Prisma.FotofficeCustomValueWhereInput,
): Promise<string[] | null> {
  const filas = await prisma.fotofficeCustomValue.findMany({
    // Siempre del workspace de la sesión y del tipo de registro de la lista.
    where: { ...where, workspaceId: ctx.workspaceId, entityType },
    select: { entityId: true },
    take: TOPE_SUBCONSULTA_CAMPOS + 1,
  });
  if (filas.length > TOPE_SUBCONSULTA_CAMPOS) return null;
  return Array.from(new Set(filas.map((f) => f.entityId)));
}

/** Los campos de un tipo de registro, listos para sumarse a una lista estándar. */
export async function camposParaListado(ctx: ContextoListado, entityType: TipoRegistroActivo): Promise<CamposDeListado> {
  const { activos, columnas, filtros, columnasExport } = armarCampos(await listarCampos(ctx.workspaceId, entityType));
  const porClave = new Map(activos.map((c) => [claveDeFiltro(c), c]));
  const buscables = activos.filter((c) => TIPOS_BUSCABLES.includes(c.type)).map((c) => c.id);

  const condicionBusqueda = async (q: string): Promise<string[] | null> => {
    const texto = q.trim();
    if (!texto || buscables.length === 0) return [];
    return idsQueCumplen(ctx, entityType, { fieldId: { in: buscables }, valueText: { contains: texto, mode: "insensitive" } });
  };

  const restriccion = async (c: ConsultaResuelta) => {
    let soloIds: string[] | null = null;
    let excedido = false;
    for (const [clave, valor] of Object.entries(c.filtros)) {
      const campo = porClave.get(clave);
      if (!campo) continue;
      const cond = condicionDeFiltro(campo, valor, c.periodos[clave]);
      if (!cond) continue;
      const ids = await idsQueCumplen(ctx, entityType, { ...cond, fieldId: campo.id });
      if (ids === null) {
        excedido = true;
        break;
      }
      const hay = new Set(ids);
      soloIds = soloIds === null ? ids : soloIds.filter((id) => hay.has(id));
    }
    let buscarIds: string[] = [];
    if (!excedido && c.q.trim()) {
      const ids = await condicionBusqueda(c.q);
      if (ids === null) excedido = true;
      else buscarIds = ids;
    }
    // Pasado el tope no se devuelven resultados parciales: la lista queda vacía y el aviso explica por qué.
    return excedido ? { soloIds: [], buscarIds: [], excedido } : { soloIds, buscarIds, excedido };
  };

  return {
    entityType,
    campos: activos,
    columnas,
    filtros,
    columnasExport,
    condicionBusqueda,
    restriccion,
    cargarValores: (ids) => valoresDe(ctx.workspaceId, entityType, ids),
  };
}

/** ¿La consulta le pide algo a los campos? Sin filtros de campo ni búsqueda no hay subconsulta. */
function tocaCampos(campos: CamposDeListado, filtros: FiltroDef[], c: ConsultaResuelta): boolean {
  if (c.q.trim() && campos.campos.some((x) => TIPOS_BUSCABLES.includes(x.type))) return true;
  return filtros.some((f) => Boolean(c.filtros[f.clave]));
}

/**
 * Suma los campos a una definición: columnas secundarias al final, filtros después de los
 * propios, columnas de exportación al final, y la restricción de filtros y búsqueda en
 * `c.campos` para que el `where` de la lista la aplique. Los valores de una página se cargan en
 * una sola consulta. Una clave que chocara con un parámetro reservado o con un filtro o una
 * columna de la lista se descarta (no puede pasar con el prefijo `cf_`, pero se cuida igual).
 */
export function conCampos<F extends object>(def: DefinicionListado<F>, campos: CamposDeListado): DefinicionListado<F & ConCampos> {
  // Sin campos la lista queda igual: `valoresCampos` es opcional en la fila.
  if (campos.campos.length === 0) return def as unknown as DefinicionListado<F & ConCampos>;
  const ocupadas = new Set<string>([...PARAMETROS_RESERVADOS, ...def.filtros.map((f) => f.clave)]);
  const filtros = campos.filtros.filter((f) => !ocupadas.has(f.clave));
  const columnasOcupadas = new Set(def.columnas.map((c) => c.clave));
  const columnas = campos.columnas.filter((c) => !columnasOcupadas.has(c.clave));

  // Una misma consulta se cuenta, se trae y se avisa: la subconsulta corre una vez por pedido.
  const memo = new Map<string, Promise<RestriccionCampos & { excedido: boolean }>>();
  const restringir = (c: ConsultaResuelta) => {
    const propios = filtros.filter((f) => c.filtros[f.clave]).map((f) => [f.clave, c.filtros[f.clave]]);
    const clave = JSON.stringify([c.q.trim(), propios]);
    let r = memo.get(clave);
    if (!r) {
      r = campos.restriccion(c);
      memo.set(clave, r);
      r.catch(() => memo.delete(clave));
    }
    return r;
  };
  const resolver = async (c: ConsultaResuelta): Promise<ConsultaResuelta> => {
    if (!tocaCampos(campos, filtros, c)) return c;
    const { soloIds, buscarIds } = await restringir(c);
    return { ...c, campos: { soloIds, buscarIds } };
  };
  const adjuntar = async (filas: F[]): Promise<(F & ConCampos)[]> => {
    if (filas.length === 0) return [];
    const valores = await campos.cargarValores(filas.map((f) => def.idDe(f)));
    return filas.map((f) => ({ ...f, valoresCampos: valores.get(def.idDe(f)) ?? new Map<string, ValorGuardado>() }));
  };
  const aviso = avisoDeCampos(def.sustantivo.plural);

  return {
    ...def,
    columnas: [...def.columnas, ...columnas],
    filtros: [...def.filtros, ...filtros],
    contar: async (ctx, c) => def.contar(ctx, await resolver(c)),
    traer: async (ctx, c, p) => adjuntar(await def.traer(ctx, await resolver(c), p)),
    traerIds: async (ctx, c, tope) => def.traerIds(ctx, await resolver(c), tope),
    traerPorIds: async (ctx, ids) => adjuntar(await def.traerPorIds(ctx, ids)),
    aviso: async (ctx, c) => {
      const [propio, deCampos] = await Promise.all([
        def.aviso ? def.aviso(ctx, c) : null,
        tocaCampos(campos, filtros, c) ? restringir(c).then((r) => (r.excedido ? aviso : null)) : null,
      ]);
      return [propio, deCampos].filter(Boolean).join(" ") || null;
    },
    exportar: { columnas: [...def.exportar.columnas, ...campos.columnasExport] },
  };
}

/**
 * Puro: aplica `c.campos` a un `where` de Prisma con `id`. `buscar` es el OR de la búsqueda
 * general de la lista (se le suma la alternativa de los campos) y `soloIds` va como AND.
 */
export function restriccionDeCampos(c: ConsultaResuelta): { buscar: { id: { in: string[] } } | null; acotar: { id: { in: string[] } } | null } {
  const r = c.campos;
  return {
    buscar: r && c.q.trim() && r.buscarIds.length > 0 ? { id: { in: r.buscarIds } } : null,
    acotar: r && r.soloIds !== null ? { id: { in: r.soloIds } } : null,
  };
}
