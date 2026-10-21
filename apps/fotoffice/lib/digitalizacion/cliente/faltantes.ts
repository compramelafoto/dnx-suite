/**
 * Qué le falta a la estación para poder grabar, en palabras para el mostrador. El botón Grabar
 * queda apagado mientras esta lista no esté vacía, y la lista se muestra debajo del botón: así nadie
 * se queda mirando un botón gris sin saber por qué.
 */
export type EstadoPreparacion = {
  videoElegido: boolean;
  audioElegido: boolean;
  /** La capturadora ya entrega imagen (hay `MediaStream`). */
  vistaPrevia: boolean;
  listaOk: boolean;
  sinPedido: boolean;
  proyectoElegido: boolean;
  dvdSubiendo: boolean;
  /** Se está continuando una grabación interrumpida: el pedido ya viene dado. */
  continuando: boolean;
};

export function faltantesParaGrabar(e: EstadoPreparacion): string[] {
  const faltan: string[] = [];
  if (!e.videoElegido) faltan.push("Elegí la capturadora en «Video».");
  if (!e.audioElegido) faltan.push("Elegí la entrada de audio en «Audio» (sin audio no se puede grabar).");
  if (e.videoElegido && e.audioElegido && !e.vistaPrevia) faltan.push("Esperá a que aparezca la vista previa de la capturadora.");
  if (!e.listaOk) faltan.push("Tocá «Listo, ya lo chequeé» en el recuadro de arriba.");
  if (!e.continuando && !e.sinPedido && !e.proyectoElegido) faltan.push("Elegí el pedido de la lista o tildá «Sin pedido (prueba)».");
  if (e.dvdSubiendo) faltan.push("Esperá a que termine de subir el DVD.");
  return faltan;
}
