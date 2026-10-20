export const FORMATOS_PREFERIDOS = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=vp9,opus",
] as const;

export function elegirFormato(soporta: (mime: string) => boolean): string | null {
  return FORMATOS_PREFERIDOS.find((m) => soporta(m)) ?? null;
}
