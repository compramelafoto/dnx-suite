/**
 * Las denuncias hechas desde el portal de equipos guardan sus archivos con clave `equipos/...`
 * en el bucket privado del portal (EQUIPOS_R2_BUCKET, mismas credenciales de R2). Las de CLF
 * (`stolen-gear/...`) siguen en el bucket de CLF.
 *
 * Devuelve el bucket a usar para firmar, o `undefined` si corresponde el bucket de CLF.
 */
export const EQUIPOS_KEY_PREFIX = "equipos/";

export function bucketOverrideForKey(
  key: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (!key.startsWith(EQUIPOS_KEY_PREFIX)) return undefined;
  const bucket = env.EQUIPOS_R2_BUCKET?.trim();
  if (!bucket) {
    throw new Error("Falta configurar EQUIPOS_R2_BUCKET para abrir archivos del portal de equipos");
  }
  return bucket;
}
