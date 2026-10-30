/**
 * Embalaje de una entrega (módulo PURO: sin base de datos, lo pueden importar pantallas cliente).
 *
 * El sobre y la bolsa no se gastan por producto sino por entrega: un sobre para todas las fotos
 * chicas, una bolsa para lo grande, y la foto que va adentro de un portarretratos no lleva sobre.
 * Diseño: docs/superpowers/specs/2026-10-30-stock-embalaje-avisos-y-conteo-design.md §4.
 */

/** `ref` del embalaje dentro del plan de consumo (`consumo-servidor.ts`). */
export const REF_EMBALAJE = "embalaje";
/** Nota de sus movimientos. Nunca `item:<id>` ni `consumo:item:<id>`, que son de otros caminos. */
export const NOTA_EMBALAJE = "consumo:embalaje";

export type TipoEnvoltorio = "SOBRE" | "BOLSA";
export const TIPOS_ENVOLTORIO: readonly TipoEnvoltorio[] = ["SOBRE", "BOLSA"];
export type FormaEntrega = "PIEZA_SUELTA" | "ENMARCADO" | "VOLUMEN" | "SIN_EMBALAJE";
export const FORMAS_ENTREGA: readonly FormaEntrega[] = ["PIEZA_SUELTA", "ENMARCADO", "VOLUMEN", "SIN_EMBALAJE"];
export const ETIQUETA_FORMA: Record<FormaEntrega, string> = {
  PIEZA_SUELTA: "Pieza suelta (foto, pendrive)",
  ENMARCADO: "Con marco (portarretratos, cuadro)",
  VOLUMEN: "Volumen (fotolibro, caja)",
  SIN_EMBALAJE: "Sin embalaje",
};

export type Envoltorio = {
  insumoId: string;
  nombre: string;
  tipo: TipoEnvoltorio;
  admiteAnchoCm: number;
  admiteAltoCm: number;
  piezasPorUnidad: number | null;
  orden: number;
};
export type EntregaProducto = {
  forma: FormaEntrega;
  anchoCm: number | null;
  altoCm: number | null;
  embalajeSiguiente: boolean;
  embalajeFijoId: string | null;
};
export type PiezaEntrega = EntregaProducto & { qty: number };
export type EmbalajeCalculado = { insumoId: string; qty: number; motivo: string };

type Medida = { menor: number; mayor: number };

function medida(a: number | null, b: number | null): Medida | null {
  if (a === null || b === null || !(a > 0) || !(b > 0)) return null;
  return { menor: Math.min(a, b), mayor: Math.max(a, b) };
}
const area = (m: Medida) => m.menor * m.mayor;
const texto = (m: Medida) => `${fmt(m.menor)}x${fmt(m.mayor)}`;
const fmt = (n: number) => String(n).replace(".", ",");

/** La orientación no importa: 15x21 entra donde entra 21x15. */
function entra(pieza: Medida, en: Medida, estricto: boolean): boolean {
  return estricto ? pieza.menor < en.menor && pieza.mayor < en.mayor : pieza.menor <= en.menor && pieza.mayor <= en.mayor;
}
const medidaDe = (e: Envoltorio) => medida(e.admiteAnchoCm, e.admiteAltoCm)!;
const masChicoPrimero = (a: Envoltorio, b: Envoltorio) => area(medidaDe(a)) - area(medidaDe(b)) || a.orden - b.orden;

const PIEZA: Record<FormaEntrega, string> = { PIEZA_SUELTA: "pieza", ENMARCADO: "portarretratos", VOLUMEN: "volumen", SIN_EMBALAJE: "" };

export function calcularEmbalaje(piezas: readonly PiezaEntrega[], envoltorios: readonly Envoltorio[]): EmbalajeCalculado[] {
  const validos = envoltorios.filter((e) => medida(e.admiteAnchoCm, e.admiteAltoCm) !== null);
  if (validos.length === 0) return [];
  const sobres = validos.filter((e) => e.tipo === "SOBRE").sort(masChicoPrimero);
  const bolsas = validos.filter((e) => e.tipo === "BOLSA").sort(masChicoPrimero);

  const sueltas = piezas
    .filter((p) => p.forma === "PIEZA_SUELTA" && p.qty > 0)
    .map((p) => ({ m: medida(p.anchoCm, p.altoCm), qty: p.qty }));
  const grandes: { pieza: PiezaEntrega; m: Medida | null }[] = piezas
    .filter((p) => (p.forma === "ENMARCADO" || p.forma === "VOLUMEN") && p.qty > 0)
    .map((p) => ({ pieza: p, m: medida(p.anchoCm, p.altoCm) }));

  // 1. Cada marco se lleva adentro una foto de su medida o, si no hay, la más grande que entre.
  for (const g of grandes) {
    if (g.pieza.forma !== "ENMARCADO" || !g.m) continue;
    for (let i = 0; i < g.pieza.qty; i++) {
      const candidatas = sueltas.filter((s) => s.qty > 0 && s.m && entra(s.m, g.m, false));
      const igual = candidatas.find((s) => s.m!.menor === g.m.menor && s.m!.mayor === g.m.mayor);
      const elegida = igual ?? candidatas.sort((a, b) => area(b.m!) - area(a.m!))[0];
      if (!elegida) break;
      elegida.qty--;
    }
  }

  // 2. Las sueltas que entran en algún sobre van en sobre (sin medida, como un pendrive, entra en cualquiera).
  const enSobre = sueltas.filter((s) => s.qty > 0 && sobres.length > 0 && (!s.m || sobres.some((e) => entra(s.m!, medidaDe(e), false))));
  const salida: EmbalajeCalculado[] = [];
  const nSobre = enSobre.reduce((a, s) => a + s.qty, 0);
  if (nSobre > 0) {
    const sobre = sobres.find((e) => enSobre.every((s) => !s.m || entra(s.m, medidaDe(e), false))) ?? sobres[sobres.length - 1]!;
    const qty = sobre.piezasPorUnidad ? Math.floor(nSobre / sobre.piezasPorUnidad) + 1 : 1;
    salida.push({ insumoId: sobre.insumoId, qty, motivo: `${nSobre} ${nSobre === 1 ? "pieza" : "piezas"} hasta ${texto(medidaDe(sobre))}` });
  }

  // 3. Lo demás va en UNA bolsa: la mayor de las que pide cada pieza.
  for (const s of sueltas) {
    if (s.qty > 0 && !enSobre.includes(s)) {
      grandes.push({ pieza: { forma: "PIEZA_SUELTA", anchoCm: s.m?.menor ?? null, altoCm: s.m?.mayor ?? null, embalajeSiguiente: false, embalajeFijoId: null, qty: s.qty }, m: s.m });
    }
  }
  // Un envoltorio fijo vale aunque el negocio no tenga bolsas; sin fijo ni bolsas, no hay en qué envolver.
  let mayor: { bolsa: Envoltorio; por: string } | null = null;
  for (const g of grandes) {
    const fijo = g.pieza.embalajeFijoId ? validos.find((e) => e.insumoId === g.pieza.embalajeFijoId) : undefined;
    const porMedida = g.m ? bolsas.find((e) => entra(g.m!, medidaDe(e), g.pieza.embalajeSiguiente)) : bolsas[0];
    const bolsa = fijo ?? porMedida ?? bolsas[bolsas.length - 1];
    if (!bolsa) continue;
    if (!mayor || masChicoPrimero(bolsa, mayor.bolsa) > 0) {
      mayor = { bolsa, por: [PIEZA[g.pieza.forma], g.m ? texto(g.m) : ""].filter(Boolean).join(" ") };
    }
  }
  if (mayor) salida.push({ insumoId: mayor.bolsa.insumoId, qty: 1, motivo: mayor.por });
  return salida;
}

// `combos.ts` impide los ciclos al guardar; esto es sólo una defensa ante un dato corrupto.
const PROFUNDIDAD_MAXIMA = 10;

/**
 * Las piezas de una entrega a partir de sus renglones. Un producto con forma de entrega aporta su
 * pieza; un combo sin forma propia se desarma en sus componentes (como la receta).
 */
export function piezasDeLineas(
  lineas: readonly { productId: string | null; qty: number }[],
  entregas: ReadonlyMap<string, EntregaProducto>,
  combos: readonly { comboProductId: string; componentProductId: string; quantity: number }[],
): PiezaEntrega[] {
  const componentes = new Map<string, { componentProductId: string; quantity: number }[]>();
  for (const c of combos) componentes.set(c.comboProductId, [...(componentes.get(c.comboProductId) ?? []), c]);

  const unidades = new Map<string, number>();
  const recorrer = (productId: string, qty: number, profundidad: number) => {
    if (entregas.has(productId)) {
      unidades.set(productId, (unidades.get(productId) ?? 0) + qty);
      return;
    }
    if (profundidad >= PROFUNDIDAD_MAXIMA) return;
    for (const c of componentes.get(productId) ?? []) recorrer(c.componentProductId, qty * c.quantity, profundidad + 1);
  };
  for (const l of lineas) if (l.productId && l.qty > 0) recorrer(l.productId, l.qty, 0);

  const piezas: PiezaEntrega[] = [];
  for (const [productId, qty] of unidades) {
    const e = entregas.get(productId)!;
    if (e.forma !== "SIN_EMBALAJE") piezas.push({ ...e, qty });
  }
  return piezas;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MEDIDA_EN_TEXTO = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/;
const medioCm = (mm: number) => Math.round(mm / 5) / 2;

function medidaDelNombre(nombre: string): { anchoCm: number | null; altoCm: number | null } {
  const m = MEDIDA_EN_TEXTO.exec(nombre);
  if (!m) return { anchoCm: null, altoCm: null };
  return { anchoCm: Number(m[1]!.replace(",", ".")), altoCm: Number(m[2]!.replace(",", ".")) };
}

/** Una propuesta para la pantalla de configuración. Nunca se guarda sola. */
export function sugerirEntrega(p: {
  nombre: string;
  categoria: string | null;
  kind: string;
  hojaMm: { ancho: number; alto: number } | null;
}): EntregaProducto | null {
  const t = sinAcentos(`${p.nombre} ${p.categoria ?? ""}`);
  const base = { embalajeSiguiente: false, embalajeFijoId: null };
  if (p.kind === "SERVICIO") return { ...base, forma: "SIN_EMBALAJE", anchoCm: null, altoCm: null };
  if (/portarretrato|marco|cuadro/.test(t)) return { ...medidaDelNombre(p.nombre), forma: "ENMARCADO", embalajeSiguiente: true, embalajeFijoId: null };
  if (/fotolibro|album/.test(t)) return { ...base, ...medidaDelNombre(p.nombre), forma: "VOLUMEN" };
  if (/pendrive|pen drive/.test(t)) return { ...base, forma: "PIEZA_SUELTA", anchoCm: null, altoCm: null };
  if (p.hojaMm) return { ...base, forma: "PIEZA_SUELTA", anchoCm: medioCm(p.hojaMm.ancho), altoCm: medioCm(p.hojaMm.alto) };
  return null;
}
