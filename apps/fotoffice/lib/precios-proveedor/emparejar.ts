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
    out.add(w.slice(0, 5));
  }
  return out;
}

type Candidato = { productId: string; puntaje: number; total: number };

function candidatos(r: RenglonLista, productos: readonly ProductoParaEmparejar[]): Candidato[] {
  if (r.tipo !== "PRODUCTO" || !r.medida) return [];
  const mismos = productos.filter((p) => medidaDe(p.name) === r.medida);
  const delRenglon = raices(`${r.producto} ${r.categoria} ${r.variante ?? ""}`);
  return mismos.map((p) => {
    let puntaje = 0;
    for (const w of raices(`${p.name} ${p.categoryName ?? ""}`)) if (delRenglon.has(w)) puntaje += 1;
    return { productId: p.id, puntaje, total: mismos.length };
  });
}

function mejor(cs: Candidato[]): Candidato | null {
  if (cs.length === 0) return null;
  const orden = [...cs].sort((a, b) => b.puntaje - a.puntaje);
  const [primero, segundo] = orden;
  if (primero!.puntaje === 0) return cs.length === 1 ? primero! : null;
  if (segundo && segundo.puntaje === primero!.puntaje) return null;
  return primero!;
}

export function sugerirProducto(r: RenglonLista, productos: readonly ProductoParaEmparejar[]): string | null {
  return mejor(candidatos(r, productos))?.productId ?? null;
}

/**
 * Sugerencias para toda la lista respetando que un producto toma su costo de un solo renglón:
 * se asigna de mayor a menor puntaje (a igual puntaje, el renglón que aparece primero) y un
 * producto ya tomado no se ofrece a otro renglón. Devuelve clave → productId.
 */
export function emparejarSugeridos(renglones: readonly RenglonLista[], productos: readonly ProductoParaEmparejar[], yaTomados: ReadonlySet<string> = new Set()): Map<string, string> {
  const propuestas: { r: RenglonLista; c: Candidato }[] = [];
  for (const r of renglones) {
    const cs = candidatos(r, productos);
    for (const c of cs) {
      if (c.puntaje === 0 && c.total !== 1) continue;
      propuestas.push({ r, c });
    }
  }
  propuestas.sort((a, b) => b.c.puntaje - a.c.puntaje || a.r.fila - b.r.fila);
  const tomados = new Set(yaTomados);
  const out = new Map<string, string>();
  for (const { r, c } of propuestas) {
    if (out.has(r.clave) || tomados.has(c.productId)) continue;
    out.set(r.clave, c.productId);
    tomados.add(c.productId);
  }
  return out;
}

/** "ROMAN" en el texto libre del producto ↔ "Román" en Proveedores. */
export function proveedorDesdeTexto(texto: string | null, proveedores: readonly { id: string; name: string }[]): string | null {
  const t = normalizarTexto(texto);
  if (t === "") return null;
  return proveedores.find((p) => normalizarTexto(p.name) === t)?.id ?? null;
}
