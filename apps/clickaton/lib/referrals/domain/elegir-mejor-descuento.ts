import { colegasQueConsumeElCanje, descuentoPorColegas } from "./escalera";

/**
 * Regla única de convivencia entre el cupón y el beneficio por referidos.
 *
 * **No se suman. Se aplica el más alto de los dos.**
 *
 * Sin esta regla, 60% por referidos más un cupón de aliado del 50% regalaría
 * la inscripción Y el kit sin que nadie lo haya decidido.
 *
 * **En empate gana el cupón**, porque así el participante sale con sus
 * referidos intactos: mismo precio hoy, y le queda saldo para la próxima.
 *
 * El sistema elige solo el que más conviene; nunca se le pide al participante
 * que decida, para que nadie desperdicie referidos por no darse cuenta.
 */

export type EleccionDescuento = {
  gana: "cupon" | "referidos" | "ninguno";
  /** Descuento efectivo en unidades menores (centavos). */
  descuentoAplicado: number;
  montoFinal: number;
  /** Porcentaje que habrían dado los referidos, se use o no. */
  porcentajeReferidos: number;
  /** Si el canje debe marcar atribuciones como consumidas. */
  consumeReferidos: boolean;
  /** Cuántas atribuciones se queman. 0 cuando no gana el beneficio. */
  colegasConsumidos: number;
};

export function elegirMejorDescuento(input: {
  montoOriginal: number;
  /** Atribuciones EARNED del participante. */
  colegas: number;
  /** Cupón ya validado por el motor de promociones, si hay. */
  cupon: { descuento: number } | null;
}): EleccionDescuento {
  const montoOriginal = Math.max(0, Math.trunc(input.montoOriginal));
  const porcentajeReferidos = descuentoPorColegas(input.colegas);

  const descuentoCupon = Math.min(
    montoOriginal,
    Math.max(0, Math.trunc(input.cupon?.descuento ?? 0)),
  );

  // Redondeo a favor del participante: 35% de 999 son 350, no 349.
  const descuentoReferidos = Math.min(
    montoOriginal,
    Math.round((montoOriginal * porcentajeReferidos) / 100),
  );

  // Sobre una entrada gratuita no se quema nada: consumir 5 colegas para
  // descontar $0 sería tirarlos.
  if (montoOriginal === 0 || (descuentoCupon === 0 && descuentoReferidos === 0)) {
    return {
      gana: "ninguno",
      descuentoAplicado: descuentoCupon,
      montoFinal: montoOriginal - descuentoCupon,
      porcentajeReferidos,
      consumeReferidos: false,
      colegasConsumidos: 0,
    };
  }

  // Empate → cupón. Estricto mayor para que los referidos ganen.
  if (descuentoReferidos > descuentoCupon) {
    return {
      gana: "referidos",
      descuentoAplicado: descuentoReferidos,
      montoFinal: montoOriginal - descuentoReferidos,
      porcentajeReferidos,
      consumeReferidos: true,
      colegasConsumidos: colegasQueConsumeElCanje(input.colegas),
    };
  }

  return {
    gana: "cupon",
    descuentoAplicado: descuentoCupon,
    montoFinal: montoOriginal - descuentoCupon,
    porcentajeReferidos,
    consumeReferidos: false,
    colegasConsumidos: 0,
  };
}
