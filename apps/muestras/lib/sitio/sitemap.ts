import { MARCAS, marcaDeDisciplina, origenPublico, type Marca, type MarcaId } from "@/lib/marca";
import { casaDePerfil, rutaDePerfil } from "@/lib/perfiles/casa";

type Env = Record<string, string | undefined>;
export type UrlSitemap = { loc: string; lastmod?: string };

/** Tope de URLs de un sitemap (el protocolo permite 50.000; con esto sobra). */
export const TOPE_SITEMAP = 5000;

/** Páginas fijas de la marca: home, convocatorias y listado de autores. */
export function urlsFijas(marca: Marca, env: Env = process.env): string[] {
  const origen = origenPublico(marca, env);
  return [`${origen}/`, `${origen}/convocatorias`, `${origen}${marca.rutaAutores}`];
}

/** Muestras y perfiles cuya casa es esta marca (las de la otra no se listan: no son de este dominio). */
export function urlsDelSitemap(
  marca: MarcaId,
  muestras: { slug: string; primaryDiscipline: string; updatedAt: Date }[],
  perfiles: { slug: string; disciplines: string[]; updatedAt: Date }[],
  env: Env = process.env,
  tope: number = TOPE_SITEMAP,
): { loc: string; lastmod: string }[] {
  const m = MARCAS[marca];
  const origen = origenPublico(m, env);
  const deMuestras = muestras
    .filter((x) => marcaDeDisciplina(x.primaryDiscipline).id === marca)
    .map((x) => ({ loc: `${origen}/m/${x.slug}`, lastmod: x.updatedAt.toISOString() }));
  const deperfiles = perfiles
    .filter((p) => casaDePerfil(p.disciplines) === marca)
    .map((p) => ({ loc: `${origen}${rutaDePerfil(m, p.slug)}`, lastmod: p.updatedAt.toISOString() }));
  return [...deMuestras, ...deperfiles].slice(0, tope);
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function xmlDelSitemap(urls: UrlSitemap[]): string {
  const filas = urls.map((u) => `<url><loc>${escapar(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filas.join("\n")}\n</urlset>\n`;
}

export function robotsDe(marca: Marca, env: Env = process.env): string {
  return `User-agent: *\nAllow: /\nDisallow: /panel\n\nSitemap: ${origenPublico(marca, env)}/sitemap.xml\n`;
}
