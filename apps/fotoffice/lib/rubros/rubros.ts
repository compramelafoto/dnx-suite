/**
 * Rubros de dos niveles (etapa 3). Módulo PURO: reglas sin base.
 *
 * Un rubro es una categoría de Caja (`CashCategory`) con un perfil opcional (`FotofficeRubro`)
 * que le suma padre y código ("3.1.2"). La tabla de Caja no cambia: una categoría sin perfil
 * es un rubro de primer nivel sin código, exactamente como hasta ahora.
 *
 * Un solo nivel: el padre no puede tener padre, y un rubro que ya es padre de otros no puede
 * pasar a tener padre (quedarían tres niveles).
 */

export type LadoRubro = "INGRESO" | "EGRESO";

/** Lo que el perfil le suma a una categoría. */
export type PerfilRubro = { parentCategoryId: string | null; code: string | null };

export const PERFIL_RUBRO_VACIO: PerfilRubro = { parentCategoryId: null, code: null };

/** Una categoría con su perfil, como la leen la pantalla y el informe. */
export type RubroFila = {
  id: string;
  name: string;
  kind: LadoRubro;
  isActive: boolean;
  order: number;
  parentCategoryId: string | null;
  code: string | null;
};

// --- Código --------------------------------------------------------------------------------------

export const TOPE_CODIGO = 20;

/** Partes de números, letras o guiones separadas por puntos: "3.1.2", "4.0", "A-1". */
const PATRON_CODIGO = /^[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*$/;

export function normalizarCodigo(raw: unknown): { ok: true; valor: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, valor: null };
  if (typeof raw !== "string") return { ok: false, error: "El código no es válido." };
  const t = raw.trim();
  if (t === "") return { ok: true, valor: null };
  if (t.length > TOPE_CODIGO) return { ok: false, error: `El código admite hasta ${TOPE_CODIGO} caracteres.` };
  if (!PATRON_CODIGO.test(t)) return { ok: false, error: "El código va con números separados por puntos, por ejemplo 3.1.2." };
  return { ok: true, valor: t };
}

/**
 * Compara códigos parte por parte, con los números como números: "3.1.2" va antes que
 * "3.1.10" (por texto quedaría al revés). Sin código va después de cualquiera con código.
 */
export function compararCodigos(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x) ? Number(x) : null;
    const ny = /^\d+$/.test(y) ? Number(y) : null;
    if (nx !== null && ny !== null) {
      if (nx !== ny) return nx - ny;
    } else {
      const c = x.localeCompare(y, "es");
      if (c !== 0) return c;
    }
  }
  return 0;
}

// --- Padre ---------------------------------------------------------------------------------------

/** El padre pedido, como se encontró en ESTE workspace (`null` si no existe ahí). */
export type PadreEncontrado = { id: string; kind: string; parentCategoryId: string | null } | null;

/**
 * Valida el padre de un rubro. `categoryId` es `null` en un alta. `hijos` son los rubros que
 * hoy cuelgan de esta categoría (vacío en un alta).
 */
export function validarPadre(input: {
  categoryId: string | null;
  kind: LadoRubro;
  parentIdPedido: string | null;
  padre: PadreEncontrado;
  hijos: readonly { kind: string }[];
}): string | null {
  // Un padre que pasa a ser de otro lado dejaría a sus hijos del lado equivocado.
  if (input.hijos.some((h) => h.kind !== input.kind)) {
    return "Este rubro tiene subrubros: no se puede pasar al otro lado sin moverlos antes.";
  }
  if (input.parentIdPedido === null) return null;
  if (input.categoryId !== null && input.parentIdPedido === input.categoryId) {
    return "Un rubro no puede ser su propio padre.";
  }
  if (input.padre === null) return "Ese rubro padre no existe.";
  if (input.padre.kind !== input.kind) return "El rubro padre tiene que ser del mismo lado (ingreso o egreso).";
  if (input.padre.parentCategoryId !== null) {
    return "El rubro padre ya está dentro de otro: los rubros tienen un solo nivel de subrubros.";
  }
  if (input.hijos.length > 0) {
    return "Este rubro ya tiene subrubros: no puede quedar dentro de otro.";
  }
  return null;
}

// --- Orden y agrupación -------------------------------------------------------------------------

/** Por código y, a igual código (o sin código), en el orden en que llegaron. */
function ordenarPorCodigo<T extends { code: string | null }>(filas: readonly T[]): T[] {
  return filas
    .map((f, i) => ({ f, i }))
    .sort((a, b) => compararCodigos(a.f.code, b.f.code) || a.i - b.i)
    .map((x) => x.f);
}

export type GrupoRubro<T> = { rubro: T; hijos: T[] };

/**
 * Agrupa por padre y ordena por código, los padres y los hijos de cada uno. Un hijo cuyo padre
 * no está en la lista (por ejemplo, dado de baja y filtrado) se muestra como de primer nivel:
 * esconderlo sería peor que mostrarlo suelto.
 */
export function agruparRubros<T extends { id: string; parentCategoryId: string | null; code: string | null }>(
  filas: readonly T[],
): GrupoRubro<T>[] {
  const ids = new Set(filas.map((f) => f.id));
  const esHijo = (f: T) => f.parentCategoryId !== null && f.parentCategoryId !== f.id && ids.has(f.parentCategoryId);
  const primeros = ordenarPorCodigo(filas.filter((f) => !esHijo(f)));
  return primeros.map((rubro) => ({
    rubro,
    hijos: ordenarPorCodigo(filas.filter((f) => esHijo(f) && f.parentCategoryId === rubro.id)),
  }));
}

/** "3.1 Estudio Fotográfico" o sólo el nombre si no tiene código. */
export function etiquetaRubro(r: { name: string; code: string | null }): string {
  return r.code ? `${r.code} ${r.name}` : r.name;
}

// --- Sugerencia desde el texto viejo del catálogo -----------------------------------------------

function clave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-AR");
}

/**
 * El rubro de Caja que corresponde al rubro en texto de la etapa 2 ("Coberturas"), sin mirar
 * mayúsculas, tildes ni espacios. `null` si no hay ninguno con ese nombre.
 */
export function sugerirRubro(
  incomeLabel: string | null,
  rubros: readonly { id: string; name: string }[],
): string | null {
  if (!incomeLabel || incomeLabel.trim() === "") return null;
  const buscado = clave(incomeLabel);
  return rubros.find((r) => clave(r.name) === buscado)?.id ?? null;
}

/** Igual que `sugerirRubro`, para reconocer un nombre ya cargado (lo usa la semilla). */
export function mismoNombre(a: string, b: string): boolean {
  return clave(a) === clave(b);
}
