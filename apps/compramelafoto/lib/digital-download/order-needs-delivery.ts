/**
 * Si un pedido pagado tiene que recibir un link de descarga.
 *
 * Esto existe por una compra real que se perdió. El pedido 3278 era de un solo
 * video, sin ninguna foto digital. La entrega miraba nada más que las fotos,
 * no encontraba ninguna, y cortaba antes de crear el link: el cliente pagó
 * $34.500 y no recibió ni el correo ni la pantalla de descarga.
 *
 * La regla es una sola línea, pero es la línea que decide si alguien recibe lo
 * que compró. Vive acá, aparte y con pruebas, para que no vuelva a perderse
 * entre las cincuenta líneas que arman la entrega.
 */

export function orderNeedsDigitalDelivery(input: {
  /** Cuántas fotos digitales tiene el pedido. */
  digitalPhotoCount: number;
  /** Cuántos videos tiene el pedido. */
  videoCount: number;
}): boolean {
  const fotos = normalizar(input.digitalPhotoCount);
  const videos = normalizar(input.videoCount);
  return fotos > 0 || videos > 0;
}

/** Un número raro (NaN, negativo, undefined) cuenta como cero, nunca rompe. */
function normalizar(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Si el aviso por correo hay que mandarlo en el momento, sin esperar nada.
 *
 * El correo de "tu descarga está lista" se dispara cuando termina de armarse el
 * ZIP de las fotos. Un pedido de sólo video no arma ningún ZIP: no hay nada que
 * preparar, el link ya sirve. Sin esta excepción el correo no salía nunca, que
 * es la otra mitad de por qué una compra real quedó sin entregar.
 *
 * Con fotos de por medio no se manda acá: lo manda el ZIP cuando está listo, y
 * duplicarlo le llegaría dos veces al cliente.
 */
export function shouldEmailDownloadRightAway(input: {
  digitalPhotoCount: number;
  videoCount: number;
}): boolean {
  const fotos = normalizar(input.digitalPhotoCount);
  const videos = normalizar(input.videoCount);
  return fotos === 0 && videos > 0;
}
