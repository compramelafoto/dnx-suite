import { useSyncExternalStore } from "react";

const sinSuscripcion = () => () => {};

/**
 * true recién cuando la página ya cargó en el navegador (React tomó el control). Antes, en el HTML
 * del servidor, false: sirve para no dejar enviar un formulario que todavía no tiene su envío.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(sinSuscripcion, () => true, () => false);
}
