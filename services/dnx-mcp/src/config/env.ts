import { envSchema, type Env } from "./schema.js";

let cachedEnv: Env | undefined;

/**
 * Carga y valida las variables de entorno.
 * El resultado se cachea para evitar re-parseos.
 */
export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    throw new Error(`Configuración inválida: ${JSON.stringify(formatted)}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Reinicia la caché de configuración (útil en tests).
 */
export function resetEnvCache(): void {
  cachedEnv = undefined;
}
