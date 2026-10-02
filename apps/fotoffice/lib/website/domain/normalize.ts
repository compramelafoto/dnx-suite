/**
 * Lo que la gente pega en "Tu dominio" viene de cualquier forma: `https://www.sfpr.com.ar/`,
 * `SFPR.com.ar`, `sfpr.com.ar/inicio`. Todo se guarda igual: dominio raíz, minúsculas, sin
 * `www.`, sin protocolo, sin barra ni camino.
 */

export type NormalizedDomain = { ok: true; domain: string } | { ok: false; error: string };

// Una etiqueta DNS: letras, números y guiones, sin empezar ni terminar en guión.
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomainInput(raw: string, reservedHosts: readonly string[] = []): NormalizedDomain {
  let value = raw.trim().toLowerCase();
  if (!value) return { ok: false, error: "Escribí tu dominio, por ejemplo sfpr.com.ar." };

  value = value.replace(/^[a-z]+:\/\//, "");
  value = value.split(/[/?#]/)[0] ?? "";
  value = value.replace(/:\d+$/, "").replace(/\.$/, "");
  if (value.startsWith("www.")) value = value.slice(4);

  const labels = value.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || /^\d+$/.test(labels.at(-1) ?? "")) {
    return { ok: false, error: "Ese dominio no es válido. Escribilo así: sfpr.com.ar" };
  }
  if (value === "localhost" || value.endsWith(".vercel.app") || reservedHosts.some((h) => sameSite(h, value))) {
    return { ok: false, error: "Ese dominio es de la plataforma, no se puede conectar." };
  }
  return { ok: true, domain: value };
}

/** `host` tal como llega en la visita: puede traer puerto y mayúsculas. */
export function hostWithoutPort(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

function sameSite(a: string, b: string): boolean {
  const strip = (h: string) => hostWithoutPort(h).replace(/^www\./, "");
  return strip(a) === strip(b);
}
