import "server-only";
import type { Candidato } from "./contactos";
import { claveDominio, claveInstagram } from "./normalizar";
import type { Region, TipoContacto } from "./tipos";
import { validarCandidato } from "./web";

/**
 * Lector barato de la web propia de un lugar de Google Places: antes de gastar Claude, se pide la
 * página directamente y se sacan los enlaces de contacto que estén a la vista (mailto:, tel:,
 * WhatsApp, Instagram, Facebook) y el nombre (og:site_name o <title>). Todo pasa por
 * `validarCandidato`, así que vale la misma validación que para lo que trae Claude y cada dato queda
 * con la página final como fuente (`SITIO_PROPIO`).
 *
 * Cuidados: sólo http/https; 10 s de plazo; se leen como mucho 1 MB; sin cookies ni credenciales;
 * las redirecciones se siguen a mano y sólo dentro del mismo dominio. Nunca lanza: ante cualquier
 * problema devuelve null y el motor sigue con Claude. El nombre de Places no se usa nunca.
 */

const PLAZO_MS = 10_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECCIONES = 5;

export type DepsSitio = { fetch?: typeof fetch };

export type ContextoSitio = {
  ciudad: string;
  provincia: string;
  region: Region;
  tipo: TipoContacto;
  nicho: string | null;
  googlePlaceId: string;
};

export type DatosDelHtml = {
  nombre: string | null;
  emails: string[];
  telefonos: string[];
  whatsapps: string[];
  instagram: string | null;
  facebook: string | null;
};

/**
 * Sólo nombres públicos: nada de IP literales (v4 o v6), puertos raros ni nombres internos. Evita
 * que una web cargada en Places (o una redirección) nos haga pedir algo de la red interna.
 */
function hostPublico(u: URL): boolean {
  if (u.port !== "" && u.port !== "80" && u.port !== "443") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.startsWith("[") || host.includes(":")) return false;
  if (/^[\d.]+$/.test(host) || /^(0x[0-9a-f]+\.?)+$/i.test(host)) return false;
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return false;
  return host.includes(".");
}

function urlHttp(texto: string): URL | null {
  try {
    const u = new URL(texto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return hostPublico(u) ? u : null;
  } catch {
    return null;
  }
}

/** Las entidades HTML más comunes (alcanza para nombres y enlaces). */
function decodificar(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function sinRepetir(lista: string[]): string[] {
  return [...new Set(lista)];
}

/** Los `href` del HTML que cumplen el patrón (ya decodificados). */
function hrefs(html: string, patron: RegExp): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*(["'])(.*?)\1/gis)) {
    const h = decodificar(m[2]!.trim());
    if (patron.test(h)) out.push(h);
  }
  return out;
}

function contenidoMeta(html: string, propiedad: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const prop = /(?:property|name)\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2];
    if (prop?.toLowerCase() !== propiedad) continue;
    const contenido = /content\s*=\s*(["'])(.*?)\1/is.exec(tag)?.[2];
    if (contenido) return decodificar(contenido).replace(/\s+/g, " ").trim() || null;
  }
  return null;
}

/** El título sin el sufijo de sección: "Foto Sur | Casamientos" → "Foto Sur". */
function nombreDeTitulo(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const titulo = decodificar(m[1]!).replace(/\s+/g, " ").trim();
  const nombre = titulo.split(/\s+[|\-–—]\s+/)[0]!.trim();
  return nombre || null;
}

/** Lo que se puede sacar del HTML sin interpretar la página. Puro. */
export function extraerDelHtml(html: string): DatosDelHtml {
  const emails = hrefs(html, /^mailto:/i)
    .map((h) => {
      let e = h.replace(/^mailto:/i, "").split("?")[0]!;
      try {
        e = decodeURIComponent(e);
      } catch {
        // se usa tal cual
      }
      return e.trim().toLowerCase();
    })
    .filter((e) => e.includes("@"));
  const telefonos = hrefs(html, /^tel:/i).map((h) => {
    let t = h.replace(/^tel:/i, "");
    try {
      t = decodeURIComponent(t);
    } catch {
      // se usa tal cual
    }
    return t.trim();
  });
  const whatsapps = hrefs(html, /^https?:\/\/(?:wa\.me|api\.whatsapp\.com)\//i);
  const instagram = hrefs(html, /^https?:\/\/(?:www\.)?instagram\.com\//i).find((h) => claveInstagram(h) !== null) ?? null;
  const facebook =
    hrefs(html, /^https?:\/\/(?:www\.|m\.)?facebook\.com\/[^/?#]+/i).find(
      (h) => !/facebook\.com\/(?:sharer|share|pages|groups|profile\.php|dialog|plugins|tr)\b/i.test(h),
    ) ?? null;
  return {
    nombre: contenidoMeta(html, "og:site_name") ?? nombreDeTitulo(html),
    emails: sinRepetir(emails),
    telefonos: sinRepetir(telefonos.filter(Boolean)),
    whatsapps: sinRepetir(whatsapps),
    instagram,
    facebook,
  };
}

/** Lee el cuerpo hasta `MAX_BYTES` (lo que sigue se descarta). */
async function leerAcotado(res: Response): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, MAX_BYTES);
  const lector = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await lector.read();
      if (done || !value) break;
      const resto = MAX_BYTES - total;
      partes.push(value.length > resto ? value.subarray(0, resto) : value);
      total += Math.min(value.length, resto);
    }
  } finally {
    await lector.cancel().catch(() => undefined);
  }
  const todo = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    todo.set(p, i);
    i += p.length;
  }
  return new TextDecoder("utf-8").decode(todo);
}

/** Pide la página siguiendo redirecciones sólo dentro del mismo dominio. Devuelve el HTML y la URL final. */
async function pedirPagina(web: string, f: typeof fetch): Promise<{ html: string; url: string } | null> {
  const primera = urlHttp(web);
  const dominio = primera ? claveDominio(primera.href) : null;
  if (!primera || !dominio) return null;
  let url: URL = primera;
  const senal = AbortSignal.timeout(PLAZO_MS);
  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const res: Response = await f(url.href, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: senal,
    });
    if (res.status >= 300 && res.status < 400) {
      const destino: string | null = res.headers.get("location");
      const siguiente: URL | null = destino ? urlHttp(new URL(destino, url).href) : null;
      if (!siguiente || claveDominio(siguiente.href) !== dominio) return null;
      url = siguiente;
      continue;
    }
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "";
    if (tipo && !/html/i.test(tipo)) return null;
    return { html: await leerAcotado(res), url: url.href };
  }
  return null;
}

const CAMPOS_CONTACTO = ["email", "telefono", "whatsapp", "instagram", "facebook"] as const;

/**
 * Candidato armado sólo con la web propia, o null si no alcanza (sin nombre o sin ningún dato de
 * contacto además de la web): entonces el motor le pregunta a Claude.
 */
export async function leerSitioPropio(web: string, t: ContextoSitio, deps: DepsSitio = {}): Promise<Candidato | null> {
  let pagina: { html: string; url: string } | null;
  try {
    pagina = await pedirPagina(web, deps.fetch ?? fetch);
  } catch {
    return null;
  }
  if (!pagina) return null;
  const e = extraerDelHtml(pagina.html);
  if (!e.nombre) return null;

  const dominio = claveDominio(pagina.url);
  // Primero un correo del propio dominio; si no hay, el primero (la validación decide si sirve).
  const email = e.emails.find((x) => dominio && (x.endsWith(`@${dominio}`) || x.endsWith(`.${dominio}`))) ?? e.emails[0];
  const dato = (valor: string | null | undefined) => (valor ? { valor, fuenteUrl: pagina.url } : undefined);
  const v = validarCandidato({
    tipo: t.tipo,
    nichos: t.nicho ? [t.nicho] : [],
    nombre: e.nombre.slice(0, 200),
    ciudad: t.ciudad,
    provincia: t.provincia,
    region: t.region,
    googlePlaceId: t.googlePlaceId,
    creadoPor: "BUSCADOR",
    datos: {
      web: dato(pagina.url),
      email: dato(email),
      telefono: dato(e.telefonos[0]),
      whatsapp: dato(e.whatsapps[0]),
      instagram: dato(e.instagram),
      facebook: dato(e.facebook),
    },
  });
  if (!v.ok) return null;
  if (!CAMPOS_CONTACTO.some((c) => v.candidato.datos[c])) return null;
  return v.candidato;
}
