/**
 * Hosts desde los que la vista 3D puede pedir imágenes de plantillas a través de nuestro dominio.
 *
 * El 3D copia cada página a una imagen en el navegador, y el navegador sólo deja copiar imágenes
 * de otro dominio si ese dominio lo autoriza (CORS). El almacenamiento público de R2 no lo hace,
 * así que el fondo de tapa y contratapa salía en blanco. Por eso esas imágenes pasan por
 * `/api/design-v2/imagen`, que sólo acepta las de nuestro propio almacenamiento: no es un
 * intermediario abierto a cualquier dirección.
 */
export function hostsDeImagenesPermitidos(env: Record<string, string | undefined> = process.env): Set<string> {
  const hosts = new Set<string>();
  for (const clave of ["R2_PUBLIC_URL", "R2_PUBLIC_BASE_URL", "NEXT_PUBLIC_R2_PUBLIC_URL", "NEXT_PUBLIC_R2_PUBLIC_BASE_URL"]) {
    const valor = env[clave]?.trim();
    if (!valor) continue;
    try {
      hosts.add(new URL(valor).host.toLowerCase());
    } catch {
      // Un valor mal escrito no habilita nada.
    }
  }
  return hosts;
}

/** La URL, si es https y de un host permitido; si no, null. */
export function urlDeImagenPermitida(raw: string | null, hosts: Set<string>): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  return hosts.has(url.host.toLowerCase()) ? url : null;
}
