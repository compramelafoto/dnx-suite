/**
 * Qué formatos se le pueden ofrecer al cliente para una foto.
 *
 * Hay dos niveles de configuración y hasta ahora sólo se miraba uno:
 *
 * - **El álbum** decide si vende digital, impreso o ambos.
 * - **Cada foto** puede quedar excluida de alguno de esos formatos.
 *
 * El selector de la pantalla de compra sólo miraba la foto, cuyo valor por
 * defecto es "sí". Resultado: en un álbum configurado para vender únicamente
 * digital, el cliente igual podía elegir "Impresa", y como no había precios de
 * impresión cargados le aparecía **$0**.
 *
 * La regla es que el álbum manda y la foto sólo puede restringir más.
 */

export type FormatsInput = {
  albumAllowsDigital: boolean | null | undefined;
  albumAllowsPrint: boolean | null | undefined;
  photoSellsDigital: boolean | null | undefined;
  photoSellsPrint: boolean | null | undefined;
};

export type AvailableFormats = {
  digital: boolean;
  print: boolean;
  /** Hay al menos un formato para ofrecer. */
  any: boolean;
  /** Cuál conviene dejar elegido de entrada. */
  preferred: "digital" | "impresa" | null;
};

/** Un valor sin definir se toma como habilitado: álbumes viejos siguen vendiendo. */
function on(v: boolean | null | undefined): boolean {
  return v !== false;
}

export function resolveAvailableFormats(input: FormatsInput): AvailableFormats {
  const digital = on(input.albumAllowsDigital) && on(input.photoSellsDigital);
  const print = on(input.albumAllowsPrint) && on(input.photoSellsPrint);

  return {
    digital,
    print,
    any: digital || print,
    // Digital primero: es lo que más se vende y no necesita elegir tamaño.
    preferred: digital ? "digital" : print ? "impresa" : null,
  };
}

/**
 * Ajusta el formato guardado de una foto a lo que se puede vender hoy.
 *
 * La pantalla de compra arma (y guarda en el navegador) los ítems antes de que
 * llegue la configuración del álbum, así que una foto podía quedar como
 * "digital" en un álbum que sólo vende impresas. El selector mostraba
 * "Impresa" —la única opción—, pero el precio se calculaba como digital: $0.
 */
export function fitTipoToFormats(
  tipo: "digital" | "impresa" | null | undefined,
  formats: AvailableFormats
): "digital" | "impresa" {
  if (tipo === "digital" && formats.digital) return "digital";
  if (tipo === "impresa" && formats.print) return "impresa";
  return formats.preferred ?? tipo ?? "digital";
}

/**
 * Medida de impresión válida para una foto del pedido.
 *
 * Mientras no llegan los precios, la pantalla usa "10x15" de relleno y lo guarda en
 * el navegador. Si el álbum no vende 10x15, el selector igual mostraba la única
 * medida disponible (p. ej. 15x20), pero el ítem seguía en 10x15: precio $0 y un
 * pedido con una medida que no existe. Con la lista de medidas cargada, una medida
 * que no está pasa a la primera disponible. Sin lista todavía, no se toca.
 */
export function fitSizeToAvailable(
  size: string | null | undefined,
  availableSizes: readonly string[],
  fallback: string
): string {
  if (availableSizes.length === 0) return size || fallback;
  if (size && availableSizes.includes(size)) return size;
  return availableSizes.includes(fallback) ? fallback : availableSizes[0];
}
