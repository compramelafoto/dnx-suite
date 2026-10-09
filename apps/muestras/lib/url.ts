/** Sólo se muestran como enlace o imagen las direcciones http:// o https://. */
export function esUrlWeb(s: string | null): s is string {
  return s != null && /^https?:\/\//i.test(s);
}
