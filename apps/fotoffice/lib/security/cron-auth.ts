/**
 * Autorización de las tareas programadas.
 *
 * Función pura: recibe el encabezado y los secretos, no lee el entorno. Así se puede probar
 * el caso que importa —que sin secreto configurado no entre nadie— sin tocar `process.env`.
 */
export function isAuthorizedCronRequest(input: {
  authorizationHeader: string | null;
  allowedSecrets: Array<string | undefined>;
}): boolean {
  const header = input.authorizationHeader ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return false;

  const permitidos = input.allowedSecrets
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  // Sin secreto configurado no se autoriza a nadie. Una ruta que corre sola y toca dinero no
  // puede quedar abierta porque falte una variable de entorno.
  if (permitidos.length === 0) return false;

  return permitidos.includes(token);
}
