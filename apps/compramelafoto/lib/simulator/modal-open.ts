/**
 * ¿Hay una ventana modal abierta (el recorrido guiado, la ayuda, la galería…)?
 *
 * Los atajos del juego (Espacio, flechas, W A S D, T, V…) escuchan en toda la
 * ventana: mientras una modal está abierta no deben disparar, sacar fotos ni
 * mover la cámara por debajo. El recorrido guiado usa Enter y las flechas para
 * avanzar, y Espacio activa su botón «Siguiente».
 */
export function isModalDialogOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}
