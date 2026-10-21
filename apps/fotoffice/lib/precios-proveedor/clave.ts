/**
 * La clave de un renglón de lista: lo que permite reconocerlo el mes siguiente aunque el
 * proveedor cambie mayúsculas, tildes o espacios. Módulo PURO.
 */

export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "30 X 20" → "20x30" (el número chico primero). Lo que no es una medida queda normalizado tal cual. */
export function normalizarMedida(s: string | null | undefined): string | null {
  const t = normalizarTexto(s).replace(/\s/g, "").replace(/,/g, ".");
  if (t === "") return null;
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(t);
  if (!m) return t;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a <= b ? `${m[1]}x${m[2]}` : `${m[2]}x${m[1]}`;
}

export type CamposClave = {
  tipo: string;
  categoria: string;
  producto: string;
  modelo: string | null;
  medida: string | null;
  variante: string | null;
  cantidadMinima: number | null;
};

/**
 * La clave con la que se recuerda un emparejamiento entre listas. Con código del proveedor, el
 * código manda (sobrevive a cambios de nombre), pero sumado a la variante y al tramo: un mismo
 * código puede venir en varios tramos por cantidad.
 */
export function claveEquivalencia(r: { clave: string; codigoProveedor: string | null; variante: string | null; cantidadMinima: number | null }): string {
  if (!r.codigoProveedor) return r.clave;
  return `cod:${normalizarTexto(r.codigoProveedor)}|${normalizarTexto(r.variante)}|${r.cantidadMinima ?? ""}`;
}

export function claveRenglon(r: CamposClave): string {
  return [
    normalizarTexto(r.tipo),
    normalizarTexto(r.categoria),
    normalizarTexto(r.producto),
    normalizarTexto(r.modelo),
    normalizarMedida(r.medida) ?? "",
    normalizarTexto(r.variante),
    r.cantidadMinima === null ? "" : String(r.cantidadMinima),
  ].join("|");
}
