/**
 * Si el cliente puede comprar la descarga de todo el material.
 *
 * Es una **orden aparte** de la del evento, y su ingreso es 100% de la plataforma: el
 * vendedor cobra el evento, nosotros el adicional. Por eso no se cobra con el token del
 * vendedor ni lleva comisión — no hay nada que repartir.
 *
 * Función pura: la regla de cuándo se puede comprar decide si alguien paga por algo que ya
 * no existe, así que se prueba sola.
 */

export type EstadoDelAdicional =
  | { sePuede: true; precioCents: number }
  | { sePuede: false; motivo: string };

export type SituacionDelEvento = {
  /** `NOT_OFFERED`, `OFFERED`, `PURCHASED`, `DELIVERED` o `EXPIRED`. */
  downloadStatus: string;
  /** Cuánto cuesta. `null` significa que la descarga ya viene incluida. */
  adicionalCents: number | null;
  /** Hasta cuándo se conserva el material. Después se borra solo. */
  retentionUntil: Date | null;
  ahora: Date;
};

export function estadoDelAdicional(evento: SituacionDelEvento): EstadoDelAdicional {
  if (evento.adicionalCents === null) {
    return { sePuede: false, motivo: "La descarga ya está incluida en tu evento." };
  }

  if (evento.downloadStatus === "PURCHASED" || evento.downloadStatus === "DELIVERED") {
    return { sePuede: false, motivo: "Ya compraste la descarga de este evento." };
  }

  if (evento.downloadStatus === "EXPIRED") {
    return { sePuede: false, motivo: "El material de este evento ya se borró." };
  }

  /*
    El material se borra solo a los 30 días. Vender la descarga después de esa fecha sería
    cobrar por algo que ya no existe: el borrado es una regla del almacenamiento y no se
    deshace pagando.
  */
  if (evento.retentionUntil && evento.ahora.getTime() >= evento.retentionUntil.getTime()) {
    return { sePuede: false, motivo: "El material de este evento ya se borró." };
  }

  if (evento.adicionalCents <= 0) {
    return { sePuede: false, motivo: "Este evento no tiene descarga a la venta." };
  }

  return { sePuede: true, precioCents: evento.adicionalCents };
}
