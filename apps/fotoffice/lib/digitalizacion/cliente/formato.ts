export const FORMATOS_PREFERIDOS = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=vp9,opus",
] as const;

export function elegirFormato(soporta: (mime: string) => boolean): string | null {
  return FORMATOS_PREFERIDOS.find((m) => soporta(m)) ?? null;
}

export type ResultadoPrueba = { ok: true } | { ok: false; error: string };

const NOMBRE_CORTO: Record<(typeof FORMATOS_PREFERIDOS)[number], string> = {
  "video/mp4;codecs=avc1,mp4a.40.2": "video/mp4",
  "video/webm;codecs=h264,opus": "video/webm h264",
  "video/webm;codecs=vp9,opus": "video/webm vp9",
};

/**
 * Que el navegador diga "lo soporto" no alcanza: con algunas capturadoras el codificador falla
 * apenas arranca. Se prueba cada formato con la señal real y se usa el primero que graba.
 */
export async function elegirFormatoQueFunciona(
  soporta: (mime: string) => boolean,
  probar: (mime: string) => Promise<ResultadoPrueba>,
): Promise<{ ok: true; mime: string; fallas: string[] } | { ok: false; fallas: string[] }> {
  const fallas: string[] = [];
  for (const mime of FORMATOS_PREFERIDOS) {
    if (!soporta(mime)) continue;
    const r = await probar(mime);
    if (r.ok) return { ok: true, mime, fallas };
    fallas.push(`${NOMBRE_CORTO[mime]} (${r.error})`);
  }
  return { ok: false, fallas };
}
