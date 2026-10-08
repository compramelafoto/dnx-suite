/**
 * Catálogo ampliado para presupuestos (etapa 2, Entrega A). Módulo PURO: reglas sin base.
 *
 * Lo usan `perfil.ts`, `combos.ts`, `costos.ts` (servidor) y las secciones de la ficha del
 * producto (navegador). Importes en centavos enteros, como el resto de Ventas.
 */

// --- Categorías de producto de DNX ------------------------------------------------------------

/** Las 11 categorías de producto de DNX Estudio (las que usaba en Alboom). */
export const CATEGORIAS_PRODUCTO_DNX = [
  "Evento",
  "Sesión",
  "Fotolibros",
  "Impresiones",
  "Almacenamiento",
  "Portaretratos",
  "Packaging",
  "Cuadros",
  "Bolsos para cámara",
  "Álbum",
  "Otro",
] as const;

/** Las que faltan, comparando sin mayúsculas ni espacios de más. */
export function categoriasFaltantes(existentes: readonly string[], deseadas: readonly string[] = CATEGORIAS_PRODUCTO_DNX): string[] {
  const clave = (s: string) => s.trim().toLocaleLowerCase("es-AR");
  const hay = new Set(existentes.map(clave));
  return deseadas.filter((d) => !hay.has(clave(d)));
}

// --- Importes ------------------------------------------------------------------------------------

const PESOS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Para mostrar: sin decimales (es-AR). */
export function pesosSinDecimales(minor: number): string {
  return PESOS.format(Math.round(minor) / 100);
}

// --- Perfil ------------------------------------------------------------------------------------

/**
 * `incomeLabel` es el rubro en texto de la etapa 2; desde la etapa 3 el rubro es
 * `incomeCategoryId` (una categoría de ingreso de Caja) y el texto sólo sirve de sugerencia.
 */
export type PerfilCatalogo = {
  inPriceList: boolean;
  incomeLabel: string | null;
  incomeCategoryId: string | null;
  isCombo: boolean;
};

/** Un producto sin fila de perfil: fuera de la lista, sin rubro, no es combo. */
export const PERFIL_VACIO: PerfilCatalogo = { inPriceList: false, incomeLabel: null, incomeCategoryId: null, isCombo: false };

export const TOPE_RUBRO = 80;

export function normalizarRubro(raw: unknown): { ok: true; valor: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, valor: null };
  if (typeof raw !== "string") return { ok: false, error: "El rubro no es válido." };
  const t = raw.trim().replace(/\s+/g, " ");
  if (t === "") return { ok: true, valor: null };
  if (t.length > TOPE_RUBRO) return { ok: false, error: `El rubro admite hasta ${TOPE_RUBRO} letras.` };
  return { ok: true, valor: t };
}

// --- Combos ------------------------------------------------------------------------------------

export type ComponenteEntrada = { productId: string; quantity: number };

export const TOPE_COMPONENTES = 50;
export const TOPE_CANTIDAD_COMPONENTE = 1000;

/**
 * Revisa la lista de componentes de un combo sin mirar la base: que no esté el combo mismo, que
 * las cantidades sean enteros positivos y que no haya repetidos (se suman: es lo que la persona
 * quiso decir al agregar dos veces lo mismo).
 */
export function normalizarComponentes(
  comboId: string,
  raw: readonly ComponenteEntrada[],
): { ok: true; valor: ComponenteEntrada[] } | { ok: false; error: string } {
  const porId = new Map<string, number>();
  for (const c of raw) {
    if (!c || typeof c.productId !== "string" || c.productId.trim() === "") return { ok: false, error: "Hay un componente sin producto." };
    if (c.productId === comboId) return { ok: false, error: "Un combo no puede contenerse a sí mismo." };
    if (!Number.isInteger(c.quantity) || c.quantity <= 0 || c.quantity > TOPE_CANTIDAD_COMPONENTE) {
      return { ok: false, error: "La cantidad de cada componente tiene que ser un número entero mayor que cero." };
    }
    porId.set(c.productId, (porId.get(c.productId) ?? 0) + c.quantity);
  }
  if (porId.size > TOPE_COMPONENTES) return { ok: false, error: `Un combo admite hasta ${TOPE_COMPONENTES} componentes.` };
  for (const q of porId.values()) {
    if (q > TOPE_CANTIDAD_COMPONENTE) return { ok: false, error: "La cantidad de un componente es demasiado grande." };
  }
  return { ok: true, valor: [...porId.entries()].map(([productId, quantity]) => ({ productId, quantity })) };
}

/**
 * ¿Darle a `comboId` estos componentes arma un ciclo (A contiene B que contiene A)?
 *
 * `aristas` son los combos que ya existen: combo → sus componentes. Las aristas actuales de
 * `comboId` no cuentan (se reemplazan). Hay ciclo si desde algún componente nuevo se llega de
 * vuelta a `comboId`.
 */
export function formaCiclo(
  comboId: string,
  componentes: readonly string[],
  aristas: ReadonlyMap<string, readonly string[]>,
): boolean {
  const visitados = new Set<string>();
  const pila = [...componentes];
  while (pila.length > 0) {
    const actual = pila.pop()!;
    if (actual === comboId) return true;
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    for (const siguiente of aristas.get(actual) ?? []) pila.push(siguiente);
  }
  return false;
}

export type ResumenCombo = {
  /** Suma de precio × cantidad de los componentes. */
  sumaComponentesMinor: number;
  /** Lo que se ahorra comprando el combo (positivo) o lo que cuesta de más (negativo). */
  ahorroMinor: number;
  /** El ahorro sobre la suma, en %, redondeado (null si la suma es cero). */
  ahorroPorcentaje: number | null;
};

export function resumenCombo(precioComboMinor: number, componentes: readonly { priceMinor: number; quantity: number }[]): ResumenCombo {
  const suma = componentes.reduce((t, c) => t + c.priceMinor * c.quantity, 0);
  const ahorro = suma - precioComboMinor;
  return {
    sumaComponentesMinor: suma,
    ahorroMinor: ahorro,
    ahorroPorcentaje: suma > 0 ? Math.round((ahorro / suma) * 100) : null,
  };
}

// --- Costos-plantilla ----------------------------------------------------------------------------

export type CostoEntrada = {
  supplierClientId: string | null;
  concept: string;
  amountMinor: number;
  perUnit: boolean;
  daysFromEvent: number;
};

export const TOPE_COSTOS = 30;
export const TOPE_CONCEPTO = 120;
export const TOPE_DIAS = 3650;
/** Lo que entra en un `Decimal(12, 2)`. */
export const TOPE_IMPORTE_MINOR = 99_999_999_999;

export function normalizarCostos(raw: readonly unknown[]): { ok: true; valor: CostoEntrada[] } | { ok: false; error: string } {
  if (raw.length > TOPE_COSTOS) return { ok: false, error: `Un producto admite hasta ${TOPE_COSTOS} costos.` };
  const out: CostoEntrada[] = [];
  for (const [i, x] of raw.entries()) {
    const fila = `Fila ${i + 1}`;
    const r = (x ?? {}) as Record<string, unknown>;
    const concept = typeof r.concept === "string" ? r.concept.trim().replace(/\s+/g, " ") : "";
    if (!concept) return { ok: false, error: `${fila}: falta el concepto.` };
    if (concept.length > TOPE_CONCEPTO) return { ok: false, error: `${fila}: el concepto es demasiado largo.` };
    const amount = r.amountMinor;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 || amount > TOPE_IMPORTE_MINOR) {
      return { ok: false, error: `${fila}: el importe no es válido.` };
    }
    const dias = r.daysFromEvent;
    if (typeof dias !== "number" || !Number.isInteger(dias) || Math.abs(dias) > TOPE_DIAS) {
      return { ok: false, error: `${fila}: los días desde el evento tienen que ser un número entero.` };
    }
    const proveedor = typeof r.supplierClientId === "string" && r.supplierClientId.trim() !== "" ? r.supplierClientId.trim() : null;
    out.push({ supplierClientId: proveedor, concept, amountMinor: amount, perUnit: r.perUnit === true, daysFromEvent: dias });
  }
  return { ok: true, valor: out };
}

/** Costo previsto de vender `cantidad` unidades: los fijos una vez, los por unidad × cantidad. */
export function costoPrevistoMinor(costos: readonly Pick<CostoEntrada, "amountMinor" | "perUnit">[], cantidad: number): number {
  const q = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0;
  return costos.reduce((t, c) => t + (c.perUnit ? Math.round(c.amountMinor * q) : c.amountMinor), 0);
}

/** "3 días antes del evento", "el día del evento", "10 días después del evento". */
export function textoDias(dias: number): string {
  if (dias === 0) return "el día del evento";
  const n = Math.abs(dias);
  return `${n} ${n === 1 ? "día" : "días"} ${dias < 0 ? "antes" : "después"} del evento`;
}
