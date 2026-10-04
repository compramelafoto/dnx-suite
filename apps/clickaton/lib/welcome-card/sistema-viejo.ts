/**
 * El interruptor del generador viejo de placas.
 *
 * Genera una sola placa —la de bienvenida—, con el diseño clavado en el código, y desde agosto
 * la venía sacando **sin un solo texto**: dibuja pidiéndole las tipografías al servidor, y el
 * servidor no tiene ninguna instalada. No se notó durante un mes y medio porque la vista previa
 * del panel también estaba rota.
 *
 * El sistema nuevo lo reemplaza: dibuja las dos placas, lleva sus tipografías adentro y toma el
 * diseño del editor visual. Este queda apagable por bandera en vez de borrado, para poder
 * volver atrás sin un despliegue si hiciera falta.
 *
 * **Sin declarar, sigue encendido.** Apagarlo tiene que ser una decisión explícita, no algo que
 * pase por olvidarse de una variable en un entorno nuevo.
 */
export const WELCOME_CARDS_LEGACY_FLAG = "CLICKATON_WELCOME_CARDS_LEGACY_ENABLED";

export function isSistemaViejoDePlacasActivo(): boolean {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- documented feature flag
  const raw = process.env.CLICKATON_WELCOME_CARDS_LEGACY_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}
