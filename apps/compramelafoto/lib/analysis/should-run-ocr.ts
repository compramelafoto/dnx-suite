/**
 * Si hay que leer el texto de las fotos de un álbum.
 *
 * Leer texto cuesta: Amazon cobra USD 1 cada 1.000 fotos, y era **la mitad** de la
 * factura. En una carrera sirve —el dorsal es como el cliente se encuentra—, pero en un
 * casamiento o un cumpleaños no hay ningún número que buscar y se pagaba igual.
 *
 * Hasta el 2026-10-09 corría en todas: el cron llamaba a `/api/internal/analysis/run`
 * con `?ocr=1`, que lo forzaba. En septiembre fueron 55.722 fotos leídas, casi ninguna
 * con algo que leer.
 *
 * Tres niveles, del más específico al más general:
 *
 * 1. **Lo pedido a mano** (`?ocr=1` / `?ocr=0`). Es la herramienta del operador para
 *    reprocesar un álbum puntual sin dejarle la configuración cambiada al fotógrafo.
 * 2. **El interruptor del álbum** (`Album.textSearchEnabled`). Lo decide el fotógrafo,
 *    que es el único que sabe si en esas fotos hay algo escrito.
 * 3. **El tipo de álbum**, para los que nunca tocaron el interruptor: sólo `SPORTS`.
 *    Es como venían los 998 álbumes anteriores, y mantiene andando a los 121 deportivos
 *    sin tocar una sola fila.
 */

/** Único tipo de álbum donde la lectura se enciende sola, sin interruptor. */
const TIPO_CON_TEXTO_UTIL = "SPORTS";

export type OcrDecisionInput = {
  /**
   * `Album.textSearchEnabled`. `null` es "el fotógrafo no lo configuró", no "apagado":
   * en ese caso decide el tipo.
   */
  textSearchEnabled: boolean | null;
  /** `Album.type`. En producción la mayoría de los álbumes lo tiene vacío. */
  albumType: string | null;
  /** `?ocr=1` / `?ocr=0`. `null` cuando nadie lo pidió explícitamente. */
  requested: boolean | null;
};

export function shouldRunOcr({
  textSearchEnabled,
  albumType,
  requested,
}: OcrDecisionInput): boolean {
  if (requested !== null) return requested;
  if (textSearchEnabled !== null) return textSearchEnabled;
  return albumType === TIPO_CON_TEXTO_UTIL;
}
