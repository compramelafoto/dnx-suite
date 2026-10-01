/**
 * Reintentar lo que vale la pena reintentar.
 *
 * En un salón el wifi se satura de a ráfagas y vuelve solo: una subida que falla a los
 * dos segundos suele andar al tercer intento. Por eso hay reintentos.
 *
 * Pero **no todo mejora esperando**. "El evento ya terminó", "aceptá las condiciones" o
 * "llegaste al tope de fotos" van a decir lo mismo dentro de dos segundos y dentro de una
 * hora. Reintentarlos son 2,4 segundos de demora para mostrar el mismo cartel, con el
 * invitado mirando la pantalla.
 */

/** Un error que no mejora esperando. Se lanza y se acabó. */
export class ErrorDefinitivo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDefinitivo";
  }
}

/**
 * ¿Este código de respuesta es definitivo?
 *
 * Los 4xx son "lo que pediste está mal": no mejoran. Los 5xx son "no pude ahora": pueden
 * mejorar. La excepción es el **408**, que dice que la conexión tardó demasiado — eso es
 * la red, no el pedido, y es justo lo que hay que reintentar.
 */
export function esDefinitivo(estado: number): boolean {
  if (estado === 408) return false;
  return estado >= 400 && estado < 500;
}

const INTENTOS = 3;
const ESPERA_BASE_MS = 800;

export async function conReintentos<T>(
  tarea: () => Promise<T>,
  opciones: { esperar?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const esperar =
    opciones.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let ultimo: unknown;

  for (let i = 0; i < INTENTOS; i++) {
    try {
      return await tarea();
    } catch (e) {
      if (e instanceof ErrorDefinitivo) throw e;
      ultimo = e;
      // Espera creciente, y no después del último intento: eso sería demorar el error.
      if (i < INTENTOS - 1) await esperar(ESPERA_BASE_MS * (i + 1));
    }
  }

  throw ultimo;
}
