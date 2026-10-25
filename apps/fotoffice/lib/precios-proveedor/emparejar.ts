import { normalizarMedida, normalizarTexto } from "./clave";
import type { RenglonLista } from "./csv";

/**
 * Sugerir qué producto del catálogo corresponde a cada renglón de la lista. Módulo PURO.
 *
 * Es sólo una sugerencia: el usuario la confirma o la cambia, y lo que confirma queda
 * recordado (`FotofficeEquivalenciaProveedor`). Por eso se prefiere no sugerir antes que
 * sugerir mal: sin medida en común, o con empate sin palabras compartidas, no hay sugerencia.
 */

export type ProductoParaEmparejar = { id: string; name: string; categoryName: string | null };

const PALABRAS_VACIAS = new Set(["con", "para", "del", "los", "las", "por", "sin", "mas", "una", "unos"]);

/**
 * Raíces que en una lista de laboratorio nombran lo mismo: la "Fotografía digital 30x40" del
 * laboratorio es la "Ampliación 30x40" o la "Copia 10x15" del estudio.
 */
const SINONIMOS: Record<string, string> = { ampli: "copia", fotog: "copia", labor: "copia", revel: "copia" };

/** La primera medida "AxB" que aparezca en el texto, normalizada. */
export function medidaDe(texto: string): string | null {
  const m = /(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/.exec(texto);
  return m ? normalizarMedida(`${m[1]}x${m[2]}`) : null;
}

/** Raíces de 5 letras: "fotoimán" y "fotoimanes" cuentan como la misma palabra. */
function raices(texto: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalizarTexto(texto).split(/[^a-z0-9]+/)) {
    if (w.length < 3 || /^\d/.test(w) || PALABRAS_VACIAS.has(w)) continue;
    const raiz = w.slice(0, 5);
    out.add(SINONIMOS[raiz] ?? raiz);
  }
  return out;
}

/**
 * Para cada renglón de tipo PRODUCTO, los productos de la misma medida que comparten más
 * palabras con él (puede haber varios: los tramos "más de 10 / 50 / 100" de una copia).
 * Sin ninguna palabra en común no se sugiere nada: mejor vacío que mal.
 */
function candidatos(r: RenglonLista, productos: readonly ProductoParaEmparejar[]): { productId: string; puntaje: number }[] {
  if (r.tipo !== "PRODUCTO" || !r.medida) return [];
  const delRenglon = raices(`${r.producto} ${r.categoria} ${r.variante ?? ""}`);
  const puntuados = productos
    .filter((p) => medidaDe(p.name) === r.medida)
    .map((p) => {
      let puntaje = 0;
      for (const w of raices(`${p.name} ${p.categoryName ?? ""}`)) if (delRenglon.has(w)) puntaje += 1;
      return { productId: p.id, puntaje };
    })
    .filter((c) => c.puntaje > 0);
  const maximo = Math.max(0, ...puntuados.map((c) => c.puntaje));
  return puntuados.filter((c) => c.puntaje === maximo);
}

/**
 * Sugerencias para toda la lista. Un producto toma su costo de un solo renglón: se asigna de
 * mayor a menor puntaje (a igual puntaje, el renglón que aparece primero) y un producto ya
 * tomado no pasa a otro renglón. Devuelve clave del renglón → productos.
 */
export function emparejarSugeridos(
  renglones: readonly RenglonLista[],
  productos: readonly ProductoParaEmparejar[],
  yaTomados: ReadonlySet<string> = new Set(),
): Map<string, string[]> {
  const propuestas: { r: RenglonLista; productId: string; puntaje: number }[] = [];
  for (const r of renglones) for (const c of candidatos(r, productos)) propuestas.push({ r, ...c });
  propuestas.sort((a, b) => b.puntaje - a.puntaje || a.r.fila - b.r.fila);
  const tomados = new Set(yaTomados);
  const out = new Map<string, string[]>();
  for (const { r, productId } of propuestas) {
    if (tomados.has(productId)) continue;
    out.set(r.clave, [...(out.get(r.clave) ?? []), productId]);
    tomados.add(productId);
  }
  return out;
}

/** "ROMAN" en el texto libre del producto ↔ "Román" en Proveedores. */
export function proveedorDesdeTexto(texto: string | null, proveedores: readonly { id: string; name: string }[]): string | null {
  const t = normalizarTexto(texto);
  if (t === "") return null;
  return proveedores.find((p) => normalizarTexto(p.name) === t)?.id ?? null;
}
