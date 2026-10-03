/**
 * Del lado del `proxy.ts`: pregunta a `/api/dominio-propio` de qué institución es un dominio, y
 * recuerda la respuesta 60 s por instancia (también los "no es de nadie"). Conectar o quitar un
 * dominio tarda como mucho eso en notarse; el DNS tarda mucho más.
 *
 * Sin dependencias de servidor a propósito (ni Prisma ni `server-only`): ver la ruta.
 * Nunca tira: ante cualquier falla devuelve null y la visita sigue sin tocar.
 */
const TTL_MS = 60_000;
const TIMEOUT_MS = 2_500;
const cache = new Map<string, { slug: string | null; at: number }>();

export async function lookupCustomDomainSlug(domain: string, apiOrigin: string): Promise<string | null> {
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.slug;

  try {
    const url = `${apiOrigin}/api/dominio-propio?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = (await res.json()) as { slug?: unknown };
    const slug = typeof body.slug === "string" && body.slug ? body.slug : null;
    cache.set(domain, { slug, at: Date.now() });
    return slug;
  } catch {
    return null;
  }
}
