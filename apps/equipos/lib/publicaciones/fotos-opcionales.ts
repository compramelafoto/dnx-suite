/**
 * Con el almacenamiento sin configurar, una vista privada puede publicar sin fotos. Sólo en
 * desarrollo local o en una vista privada de Vercel (`VERCEL_ENV=preview`); nunca en producción.
 */
export function fotosOpcionales(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.EQUIPOS_FOTOS_OPCIONALES !== "1") return false;
  if (env.VERCEL_ENV === "production") return false;
  return env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview";
}
