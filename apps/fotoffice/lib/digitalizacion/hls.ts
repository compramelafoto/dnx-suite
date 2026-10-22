/**
 * Versión para mirar (spec 2026-10-22, E10): el worker deja en R2 `<hlsKey>/index.m3u8` (VOD) y
 * los segmentos `seg_00001.ts`… El bucket es privado, así que la app sirve la playlist reescrita
 * con cada segmento como URL firmada. Sólo se firman nombres de segmento nuestros.
 */

export const NOMBRE_PLAYLIST = "index.m3u8";
export const TIPO_PLAYLIST = "application/vnd.apple.mpegurl";
const REGEX_SEGMENTO = /^seg_\d{1,6}\.ts$/;

/** null si la playlist no es una VOD terminada con sólo segmentos nuestros (no se sirve). */
export function reescribirPlaylist(texto: string, firmar: (segmento: string) => string): string | null {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas[0] !== "#EXTM3U" || !lineas.includes("#EXT-X-ENDLIST")) return null;
  const salida: string[] = [];
  let segmentos = 0;
  for (const l of lineas) {
    if (l.startsWith("#")) {
      // Una etiqueta con URI apuntaría a otro archivo sin firmar (clave, mapa, otra playlist).
      if (/URI\s*=/i.test(l)) return null;
      salida.push(l);
      continue;
    }
    if (!REGEX_SEGMENTO.test(l)) return null;
    salida.push(firmar(l));
    segmentos++;
  }
  return segmentos > 0 ? `${salida.join("\n")}\n` : null;
}

/** La playlist firmada: privada y sin caché (las firmas vencen y son de quien la pidió). */
export function respuestaPlaylist(texto: string): Response {
  return new Response(texto, {
    status: 200,
    headers: { "Content-Type": TIPO_PLAYLIST, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
  });
}

export function respuestaSinPlaylist(estado: number, texto: string): Response {
  return new Response(texto, { status: estado, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
}

/** Igual que el worker: con 3 intentos fallados el relleno no se reintenta más. */
export const MAX_INTENTOS_HLS = 3;

/**
 * El relleno se dio por vencido: sin `hlsKey` y con `conversionError` = `HLS:<n>:<causa>`, n ≥ 3.
 * `HLS:<n>:` sin causa es un intento todavía en curso.
 */
export function vistaPreviaAgotada(hlsKey: string | null, conversionError: string | null): boolean {
  if (hlsKey || !conversionError) return false;
  const m = /^HLS:(\d+):(.+)$/s.exec(conversionError);
  return m !== null && Number(m[1]) >= MAX_INTENTOS_HLS && m[2]!.trim().length > 0;
}
