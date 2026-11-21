import { marcaPorHost, origenPublico } from "@/lib/marca";

/**
 * Base (https://dominio) a la que vuelve el ingreso: la del dominio desde el que se entró.
 * Un host desconocido cae en fotografía, así que nunca se usa un host ajeno como base.
 */
export function baseDeIngreso(req: Request, env: Record<string, string | undefined> = process.env): string {
  return origenPublico(marcaPorHost(new URL(req.url).host), env);
}
