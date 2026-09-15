/**
 * Qué de un producto puede salir del workspace, y qué no. Módulo PURO.
 *
 * El catálogo maestro (§3.4 del diseño) comparte la IDENTIDAD de un producto entre todos los
 * negocios de la suite, y nada más. El precio, el costo, la existencia, el proveedor y el
 * código interno son del negocio y no salen nunca.
 *
 * Los cuatro campos se nombran uno por uno a propósito. Con un spread y exclusiones, el día
 * que alguien agregue un campo nuevo al producto ese campo viajaría solo al catálogo
 * compartido sin que nadie lo decida. Así, un campo nuevo no viaja hasta que alguien lo
 * escriba acá.
 */

export type GlobalFields = {
  name: string;
  brand: string | null;
  description: string | null;
  imageUrl: string | null;
};

export function globalFieldsFromProduct(p: {
  name: string;
  brand?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}): GlobalFields {
  return {
    name: p.name,
    brand: p.brand ?? null,
    description: p.description ?? null,
    imageUrl: p.imageUrl ?? null,
  };
}

export type ProductPrefill = GlobalFields & { foundInGlobal: boolean };

/**
 * Lo que el formulario de alta muestra cuando se escanea un código.
 *
 * Precarga y nada más: lo que la persona guarde en su propio producto es lo que vale. Si
 * mañana alguien corrige mal la ficha compartida, ningún negocio ve cambiar su catálogo.
 */
export function prefillFromGlobal(global: GlobalFields | null): ProductPrefill {
  if (global === null) {
    return { name: "", brand: null, description: null, imageUrl: null, foundInGlobal: false };
  }
  return { ...global, foundInGlobal: true };
}
