/**
 * El precio del evento y el del adicional de descarga (capítulo 6.5).
 *
 * Son dos cosas distintas que se parecen y conviene no mezclar:
 *  - la **comisión de la plataforma** (15%) sale de la venta del evento;
 *  - el **adicional de descarga** (15% sugerido) es un precio que paga el cliente aparte,
 *    y su ingreso es 100% de Subí la Foto.
 *
 * Todo en centavos enteros. Un `Float` acá es plata mal contada.
 */

export type ModoDescarga = "INCLUDED" | "PERCENT" | "FIXED";

export type OfertaPrecio = {
  basePriceCents: number;
  downloadMode: ModoDescarga;
  /** Puntos básicos: 1500 = 15,00 %. Evita decimales en la configuración. */
  downloadPercentBps: number | null;
  downloadPriceCents: number | null;
};

export type Precios = {
  baseCents: number;
  /** `null` cuando la descarga ya viene incluida: no hay nada extra que cobrar. */
  adicionalCents: number | null;
  totalCents: number;
};

export function calcularPrecios(oferta: OfertaPrecio): Precios {
  const baseCents = oferta.basePriceCents;

  let adicionalCents: number | null;

  switch (oferta.downloadMode) {
    case "INCLUDED":
      adicionalCents = null;
      break;

    case "PERCENT": {
      const bps = oferta.downloadPercentBps;
      if (bps === null || bps === undefined) {
        throw new Error(
          "La descarga está configurada por porcentaje pero no tiene porcentaje definido.",
        );
      }
      // Redondeo al centavo. Sin esto quedan fracciones que Mercado Pago rechaza.
      adicionalCents = Math.round((baseCents * bps) / 10_000);
      break;
    }

    case "FIXED": {
      const fijo = oferta.downloadPriceCents;
      if (fijo === null || fijo === undefined) {
        throw new Error(
          "La descarga está configurada con precio fijo pero no tiene precio definido.",
        );
      }
      adicionalCents = fijo;
      break;
    }
  }

  return {
    baseCents,
    adicionalCents,
    totalCents: baseCents + (adicionalCents ?? 0),
  };
}

const FORMATO = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "$ 120.000" — sin centavos cuando son cero, que es como se escribe un precio acá. */
export function formatearPesos(centavos: number): string {
  return FORMATO.format(centavos / 100).replace(/ /g, " ");
}
