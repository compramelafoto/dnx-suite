import { compilarRedirecciones, type ReglaRedireccion, type TablaRedirecciones } from "@/lib/website/redirecciones-reglas";

/**
 * Del lado del `proxy.ts`: pregunta a `/api/dominio-propio` de qué institución es un dominio (y
 * qué redirecciones tiene su sitio), y recuerda la respuesta 60 s por instancia (también los "no es
 * de nadie"). Conectar o quitar un dominio, o cambiar una redirección, tarda como mucho eso en
 * notarse; el DNS tarda mucho más.
 *
 * Sin dependencias de servidor a propósito (ni Prisma ni `server-only`): ver la ruta.
 * Nunca tira: ante cualquier falla devuelve null y la visita sigue sin tocar.
 */
const TTL_MS = 60_000;
const TIMEOUT_MS = 2_500;

export type CustomDomainSite = { slug: string; redirecciones: TablaRedirecciones };

const cache = new Map<string, { site: CustomDomainSite | null; at: number }>();

function reglasValidas(raw: unknown): ReglaRedireccion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is ReglaRedireccion =>
      typeof r === "object" && r !== null && typeof r.desde === "string" && typeof r.hacia === "string" && typeof r.codigo === "number",
  );
}

export async function lookupCustomDomain(domain: string, apiOrigin: string): Promise<CustomDomainSite | null> {
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.site;

  try {
    const url = `${apiOrigin}/api/dominio-propio?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = (await res.json()) as { slug?: unknown; redirecciones?: unknown };
    const slug = typeof body.slug === "string" && body.slug ? body.slug : null;
    // Las reglas se compilan una vez por respuesta, no en cada visita.
    const site = slug ? { slug, redirecciones: compilarRedirecciones(reglasValidas(body.redirecciones)) } : null;
    cache.set(domain, { site, at: Date.now() });
    return site;
  } catch {
    return null;
  }
}

export async function lookupCustomDomainSlug(domain: string, apiOrigin: string): Promise<string | null> {
  return (await lookupCustomDomain(domain, apiOrigin))?.slug ?? null;
}
