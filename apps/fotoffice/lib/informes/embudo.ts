/**
 * Embudo de consultas (etapa 6, Entrega B). Módulo PURO: agrupa las consultas que ENTRARON en el
 * período (por su fecha de alta, día de Buenos Aires) por categoría u origen. La lectura vive en
 * `embudo-datos.ts`.
 *
 * Fuente de "ganada" / "perdida" / fecha de cierre: el recorrido de venta de la consulta
 * (`FotofficeJourney` con `subjectType` CAPTACION y `kind` VENTA; `outcome` GANADA o PERDIDA y
 * `closedAt`), que es lo que muestra hoy la lista de Consultas en su columna de resultado y lo que
 * filtra su filtro "Resultado". `ServiceSalesLead.status` (WON / LOST) es sólo un espejo que el motor
 * de circuitos escribe al cerrar; si alguna vez discrepan, manda el recorrido (como en Consultas).
 * Una consulta sin recorrido de venta cuenta como abierta (así la muestra Consultas).
 */

export const AGRUPAMIENTOS_EMBUDO = ["categoria", "origen"] as const;
export type AgrupamientoEmbudo = (typeof AGRUPAMIENTOS_EMBUDO)[number];
export const AGRUPAMIENTO_EMBUDO_POR_OMISION: AgrupamientoEmbudo = "categoria";

export const ETIQUETAS_AGRUPAMIENTO_EMBUDO: Record<AgrupamientoEmbudo, string> = {
  categoria: "Categoría",
  origen: "Origen",
};

export const SIN_CATEGORIA = "Sin categoría";
export const SIN_ORIGEN = "Sin origen";

export function agrupamientoEmbudoElegido(v: unknown): AgrupamientoEmbudo {
  return (AGRUPAMIENTOS_EMBUDO as readonly string[]).includes(v as string) ? (v as AgrupamientoEmbudo) : AGRUPAMIENTO_EMBUDO_POR_OMISION;
}

export type ResultadoConsulta = "GANADA" | "PERDIDA" | null;

/** Una consulta ya leída, con los nombres y el resultado resueltos. */
export type ConsultaEmbudo = {
  id: string;
  /** Alta de la consulta (instante). */
  creadaEn: Date;
  /** `null` si la consulta no tiene ficha (categoría y origen desconocidos). */
  categoriaId: string | null;
  categoria: string | null;
  origenId: string | null;
  origen: string | null;
  valorEstimadoCentavos: number;
  /** `null` = abierta (o sin recorrido de venta). */
  resultado: ResultadoConsulta;
  /** Cierre del recorrido (`closedAt`); `null` si está abierta o no tiene fecha. */
  cerradaEn: Date | null;
  /** Suma de `totalArs` de los pedidos no cancelados de la consulta, en centavos. */
  vendidoCentavos: number;
};

export type FilaEmbudo = {
  clave: string;
  /** Id de la categoría u origen; `null` en las filas "Sin …". */
  idGrupo: string | null;
  etiqueta: string;
  entraron: number;
  ganadas: number;
  perdidas: number;
  abiertas: number;
  /** Porcentaje con un decimal (ganadas ÷ entraron), `null` si no entró ninguna. */
  conversion: number | null;
  valorEstimado: number;
  vendido: number;
  /** Días promedio hasta cerrar (un decimal); `null` si no hay cerradas con fecha de cierre. */
  diasPromedio: number | null;
  /** Para calcular el promedio del total sin promediar promedios. */
  sumaDias: number;
  cerradasConFecha: number;
};

export type TablaEmbudo = {
  agrupar: AgrupamientoEmbudo;
  filas: FilaEmbudo[];
  total: FilaEmbudo;
};

const DIA_MS = 24 * 60 * 60 * 1000;

const redondear1 = (n: number) => Math.round(n * 10) / 10;

function cerrarFila(f: FilaEmbudo): FilaEmbudo {
  f.conversion = f.entraron > 0 ? redondear1((f.ganadas / f.entraron) * 100) : null;
  f.diasPromedio = f.cerradasConFecha > 0 ? redondear1(f.sumaDias / f.cerradasConFecha) : null;
  return f;
}

function filaVacia(clave: string, idGrupo: string | null, etiqueta: string): FilaEmbudo {
  return { clave, idGrupo, etiqueta, entraron: 0, ganadas: 0, perdidas: 0, abiertas: 0, conversion: null, valorEstimado: 0, vendido: 0, diasPromedio: null, sumaDias: 0, cerradasConFecha: 0 };
}

function grupoDe(c: ConsultaEmbudo, agrupar: AgrupamientoEmbudo): { clave: string; idGrupo: string | null; etiqueta: string } {
  if (agrupar === "categoria") {
    return c.categoriaId === null ? { clave: "sin", idGrupo: null, etiqueta: SIN_CATEGORIA } : { clave: `k:${c.categoriaId}`, idGrupo: c.categoriaId, etiqueta: c.categoria ?? SIN_CATEGORIA };
  }
  return c.origenId === null ? { clave: "sin", idGrupo: null, etiqueta: SIN_ORIGEN } : { clave: `o:${c.origenId}`, idGrupo: c.origenId, etiqueta: c.origen ?? SIN_ORIGEN };
}

/** Embudo por grupo. Orden: más consultas primero; "Sin …" siempre al final. */
export function armarEmbudo(params: { consultas: readonly ConsultaEmbudo[]; agrupar: AgrupamientoEmbudo }): TablaEmbudo {
  const { consultas, agrupar } = params;
  const filas = new Map<string, FilaEmbudo>();
  const total = filaVacia("total", null, "Total");
  for (const c of consultas) {
    const g = grupoDe(c, agrupar);
    const f = filas.get(g.clave) ?? filaVacia(g.clave, g.idGrupo, g.etiqueta);
    for (const x of [f, total]) {
      x.entraron++;
      if (c.resultado === "GANADA") x.ganadas++;
      else if (c.resultado === "PERDIDA") x.perdidas++;
      else x.abiertas++;
      x.valorEstimado += c.valorEstimadoCentavos;
      x.vendido += c.vendidoCentavos;
      if (c.resultado !== null && c.cerradaEn) {
        x.sumaDias += Math.max(0, (c.cerradaEn.getTime() - c.creadaEn.getTime()) / DIA_MS);
        x.cerradasConFecha++;
      }
    }
    filas.set(g.clave, f);
  }
  const lista = [...filas.values()].map(cerrarFila).sort((a, b) => {
    if ((a.idGrupo === null) !== (b.idGrupo === null)) return a.idGrupo === null ? 1 : -1;
    return b.entraron - a.entraron || a.etiqueta.localeCompare(b.etiqueta, "es");
  });
  return { agrupar, filas: lista, total: cerrarFila(total) };
}

/** "2026-10" → último día "2026-10-31". */
function ultimoDia(mes: string): string {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
  return `${mes}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Enlace a la lista de Consultas. La lista acepta por dirección `categoria` / `origen` (id), `alta`
 * (rango de días `AAAA-MM-DD..AAAA-MM-DD`, hora de Buenos Aires) y `resultado` (abierta / GANADA /
 * PERDIDA), que son los mismos criterios de este informe. Las filas "Sin …" no tienen filtro en la
 * lista: no llevan enlace (`null`).
 */
export function hrefConsultas(params: { agrupar: AgrupamientoEmbudo; idGrupo: string | null; desde: string; hasta: string; resultado?: "abierta" | "GANADA" | "PERDIDA" }): string | null {
  if (params.idGrupo === null) return null;
  const q = new URLSearchParams({
    [params.agrupar]: params.idGrupo,
    alta: `${params.desde}-01..${ultimoDia(params.hasta)}`,
  });
  if (params.resultado) q.set("resultado", params.resultado);
  return `/consultas/lista?${q.toString()}`;
}
