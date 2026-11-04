/**
 * Modelo y talle sin migración: si TODAS las variantes activas se llaman "<Modelo> / <Talle>"
 * (por ejemplo "Oversize negra / M"), la ficha muestra dos selectores en vez de uno. Si alguna no
 * sigue ese formato, no hay ejes y la ficha se ve como siempre. Es lógica pura, sin React.
 */

export const SEPARADOR_MODELO_TALLE = " / ";

export type VariantLike = { id: string; name: string; available: number | null };

export type VariantAxisOption = { variantId: string; model: string; size: string; available: number | null };

export type VariantAxes = {
  /** Los modelos sin repetir, en el orden de las variantes. */
  models: string[];
  /** Una opción por variante, en el orden de las variantes. */
  options: VariantAxisOption[];
};

/** Parte el nombre en el PRIMER " / ". `null` si no tiene ese formato o alguna mitad queda vacía. */
export function splitVariantName(name: string): { model: string; size: string } | null {
  const i = name.indexOf(SEPARADOR_MODELO_TALLE);
  if (i < 0) return null;
  const model = name.slice(0, i).trim();
  const size = name.slice(i + SEPARADOR_MODELO_TALLE.length).trim();
  if (!model || !size) return null;
  return { model, size };
}

/** Los ejes, o `null` si no hay variantes o alguna no sigue el formato "Modelo / Talle". */
export function buildVariantAxes(variants: VariantLike[]): VariantAxes | null {
  if (variants.length === 0) return null;
  const options: VariantAxisOption[] = [];
  const models: string[] = [];
  for (const v of variants) {
    const partes = splitVariantName(v.name);
    if (!partes) return null;
    options.push({ variantId: v.id, model: partes.model, size: partes.size, available: v.available });
    if (!models.includes(partes.model)) models.push(partes.model);
  }
  return { models, options };
}

/** Los talles de un modelo, en el orden de las variantes. */
export function sizesForModel(axes: VariantAxes, model: string | null): VariantAxisOption[] {
  if (model === null) return [];
  return axes.options.filter((o) => o.model === model);
}

/** Un modelo está agotado cuando todos sus talles lo están. */
export function isModelSoldOut(axes: VariantAxes, model: string): boolean {
  return sizesForModel(axes, model).every((o) => o.available === 0);
}

/** La variante que corresponde a modelo + talle, o `null`. */
export function findVariantId(axes: VariantAxes, model: string | null, size: string | null): string | null {
  if (model === null || size === null) return null;
  return axes.options.find((o) => o.model === model && o.size === size)?.variantId ?? null;
}

/** La opción (modelo y talle) de una variante, o `null`. */
export function optionForVariant(axes: VariantAxes, variantId: string | null): VariantAxisOption | null {
  if (variantId === null) return null;
  return axes.options.find((o) => o.variantId === variantId) ?? null;
}

/**
 * Qué variante queda elegida al cambiar de modelo: el mismo talle si existe y no está agotado; si
 * no, el único talle disponible si hay uno solo; si no, ninguna (que elija).
 */
export function variantAfterModelChange(axes: VariantAxes, model: string, previousSize: string | null): string | null {
  const disponibles = sizesForModel(axes, model).filter((o) => o.available !== 0);
  const mismo = previousSize === null ? undefined : disponibles.find((o) => o.size === previousSize);
  if (mismo) return mismo.variantId;
  return disponibles.length === 1 ? disponibles[0].variantId : null;
}

function normalizar(texto: string): string {
  return texto.trim().toLocaleLowerCase("es");
}

/** La posición de la foto cuyo texto alternativo es el modelo (sin importar mayúsculas), o -1. */
export function imageIndexForModel(images: { alt: string | null }[], model: string | null): number {
  if (model === null) return -1;
  const buscado = normalizar(model);
  if (!buscado) return -1;
  return images.findIndex((img) => img.alt !== null && normalizar(img.alt) === buscado);
}
