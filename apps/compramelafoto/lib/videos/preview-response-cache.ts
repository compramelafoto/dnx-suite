/**
 * Con qué estado y con qué caché se devuelve el adelanto de un video.
 *
 * Esto existe por un error real y difícil de ver: el código ya devolvía 206
 * correctamente, pero la respuesta salía con `Cache-Control: public`. El CDN
 * guardaba ese primer pedacito de video y se lo servía a todo el mundo como un
 * 200 con `Content-Range` adentro — una respuesta contradictoria que Safari y
 * el iPhone rechazan, y el video no arrancaba.
 *
 * La regla: el adelanto se cachea en el navegador de cada persona, nunca en el
 * CDN compartido. Así el que rebobina no vuelve a descargar, y nadie recibe el
 * fragmento cacheado de otro.
 */

export type PreviewResponseCache = {
  /** 206 cuando la respuesta es un fragmento; si no, el estado de origen. */
  status: number;
  /** Valor exacto del encabezado `Cache-Control`. */
  cacheControl: string;
  /** Valor exacto del encabezado `Vary`. */
  vary: string;
};

/** Una hora: el adelanto tiene la marca quemada y nunca cambia. */
export const PREVIEW_BROWSER_CACHE_SECONDS = 3600;

export function resolvePreviewResponseCache(input: {
  /** El encabezado `Range` que mandó el reproductor, si mandó alguno. */
  requestedRange: string | null;
  /** El estado con el que respondió R2. */
  upstreamStatus: number;
  /** Si la respuesta de R2 trae `Content-Range`, o sea, es un fragmento. */
  hasContentRange: boolean;
}): PreviewResponseCache {
  const { requestedRange, upstreamStatus, hasContentRange } = input;

  // Un fragmento SIEMPRE es 206. Un 200 con Content-Range es inválido.
  const status = hasContentRange ? 206 : upstreamStatus;

  // `private` es lo que impide que el CDN guarde y reparta el fragmento.
  // `Vary: Range` es el cinturón de seguridad: aunque algún intermediario
  // ignore `private`, no puede mezclar la respuesta de un rango con la de otro.
  const cacheControl = `private, max-age=${PREVIEW_BROWSER_CACHE_SECONDS}`;

  // Se declara siempre, haya venido rango o no: la respuesta entera tampoco
  // puede reutilizarse para contestar un pedido con `Range`.
  void requestedRange;

  return { status, cacheControl, vary: "Range" };
}
