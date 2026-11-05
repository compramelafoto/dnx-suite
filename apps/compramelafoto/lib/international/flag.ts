/** Nombre de la variable de entorno que enciende CLF internacional. */
export const INTERNATIONAL_ENV_VAR = "CLF_INTERNATIONAL_ENABLED";

/** CLF internacional está apagado salvo que la variable valga exactamente "true". */
export function isInternationalEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[INTERNATIONAL_ENV_VAR] === "true";
}
