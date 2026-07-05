/**
 * Copy unificado sobre `extraUnitPriceOverrideArs`:
 * precio por cada unidad que el cliente suma al canjear, además de las incluidas en el pack
 * (override del precio de lista del laboratorio para esa línea; ver spec §2.2).
 */

export function formatExtraUnitPriceDashboard(extra: number | null | undefined): string {
  if (extra != null && extra > 0) {
    return `Si quiere sumar más además de lo incluido, cada extra sale $${extra.toLocaleString(
      "es-AR"
    )}. Ese importe se suma al valor del pack que ya compró; no reemplaza lo que ya está cubierto por el pack.`;
  }
  return `Si más adelante suma extras al canjear y no cargaste un monto acá, cada uno se cotiza con el precio de lista del laboratorio en ese momento.`;
}

/** Párrafo único para términos (cliente). */
export function extraUnitPriceTermsParagraph(extra: number | null | undefined): string {
  if (extra != null && extra > 0) {
    return `Si querés sumar más además de lo que ya trae el pack, cada extra sale $${extra.toLocaleString(
      "es-AR"
    )}. Ese importe se suma a lo que ya pagaste por el pack; no reemplaza las descargas o impresos que ya venían incluidos.`;
  }
  return `Si más adelante sumás extras al canjear, el precio de cada uno va a ser el de lista del laboratorio en ese momento, salvo que en el flujo se indique otra cosa.`;
}
