/** Antes de tocar ninguna fila: confirma que hay acceso al bucket. Devuelve false (y lo informa) si no. */
export async function preflightBucket(
  r2: { verificarAcceso(): Promise<void> },
  bucket: string,
  error: (m: string) => void,
): Promise<boolean> {
  try {
    await r2.verificarAcceso();
    return true;
  } catch (e) {
    error(`[digitalizacion] R2 sin acceso al bucket ${bucket}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}
