import { isTrackingExcludedPath } from "./site-settings";
import { SITE_FOLDER_SEGMENTS } from "./reserved-slugs";
import { SITE_RESERVED_SEGMENTS } from "./public-modules";

/**
 * Contador de visitas por página del sitio público (PR D de las secciones de Prosite). Reglas
 * puras, sin base ni Next, para poder probarlas enteras. El lado del servidor está en
 * `visitas.server.ts`; el beacon del navegador en `components/website/render/contador-visitas.tsx`.
 *
 * Qué se guarda: workspace, ruta normalizada, día (hora argentina) y cantidad. Nada más: ni
 * cookies, ni IP, ni navegador, ni de dónde vino la persona.
 * Spec: docs/superpowers/specs/2026-10-27-sitio-herramientas-prosite-design.md (PR D)
 */

/** Largo máximo de la ruta que llega del navegador (antes de normalizar). */
export const MAX_LARGO_RUTA = 300;
/** Largo máximo de la ruta que se guarda. */
const MAX_LARGO_RUTA_GUARDADA = 200;
/** Segmentos máximos: el sitio no tiene direcciones más hondas que `/trabajos/<categoria>/<trabajo>`. */
const MAX_SEGMENTOS = 4;

/** Caracteres de un segmento de ruta del sitio (slugs, ids y algún punto). */
const SEGMENTO_VALIDO = /^[a-z0-9][a-z0-9._-]*$/;

/**
 * Primeros segmentos del sitio que NO se cuentan: no son páginas que la gente lee (la puerta de
 * acceso, el formulario insertado en otra web, documentos —tienen su propio contador—, la API y
 * archivos de máquinas).
 */
const SEGMENTOS_NO_CONTADOS = new Set(["entrar", "insertar", "d", "api", "w", "sitemap.xml", "robots.txt"]);

/** Primeros segmentos que son secciones del sitio (módulos y carpetas reales). */
const SEGMENTOS_DEL_SITIO: ReadonlySet<string> = new Set(
  [...SITE_FOLDER_SEGMENTS, ...SITE_RESERVED_SEGMENTS].filter((s) => !SEGMENTOS_NO_CONTADOS.has(s)),
);

/**
 * La ruta que se guarda para una dirección del sitio, o `null` si esa visita no se cuenta.
 *
 * - Acepta las dos formas: `/w/<slug>/…` (dominio de FOTOFFICE) y `/…` (dominio propio). Una
 *   ruta `/w/<otro>/…` no se cuenta para este sitio.
 * - Saca consulta, `#`, barras repetidas y la barra final; `/` es la portada.
 * - No se cuenta: una ruta con token (mismo criterio que la medición, `isTrackingExcludedPath`),
 *   una ruta demasiado larga u honda, con caracteres raros, o cuyo primer segmento no sea una
 *   sección del sitio ni una de sus páginas propias (`paginasPropias`, los slugs publicados).
 */
export function normalizarRutaVisita(rutaCruda: string, workspaceSlug: string, paginasPropias: ReadonlySet<string>): string | null {
  if (typeof rutaCruda !== "string" || rutaCruda.length === 0 || rutaCruda.length > MAX_LARGO_RUTA) return null;
  const [sinHash] = rutaCruda.split("#");
  const [ruta, consulta = ""] = sinHash.split("?");
  if (!ruta.startsWith("/")) return null;

  let segs = ruta.split("/").filter(Boolean);
  if (segs[0] === "w") {
    if (segs[1] !== workspaceSlug) return null;
    segs = segs.slice(2);
  }
  let decodificados: string[];
  try {
    decodificados = segs.map((s) => decodeURIComponent(s).toLowerCase());
  } catch {
    return null;
  }
  if (decodificados.length > MAX_SEGMENTOS) return null;
  if (!decodificados.every((s) => SEGMENTO_VALIDO.test(s))) return null;

  const normalizada = decodificados.length === 0 ? "/" : `/${decodificados.join("/")}`;
  if (normalizada.length > MAX_LARGO_RUTA_GUARDADA) return null;
  if (isTrackingExcludedPath(normalizada, consulta)) return null;
  if (normalizada === "/") return normalizada;

  const primero = decodificados[0];
  if (SEGMENTOS_NO_CONTADOS.has(primero)) return null;
  if (SEGMENTOS_DEL_SITIO.has(primero)) return normalizada;
  // Las páginas propias no se anidan: sólo `/<slug>`.
  if (decodificados.length === 1 && paginasPropias.has(primero)) return normalizada;
  return null;
}

/**
 * ¿Lo pide una máquina? Buscadores, vistas previas de redes y mensajería, monitores, navegadores
 * sin pantalla y herramientas de línea de comandos. Sin user-agent, también.
 */
const PATRON_BOT =
  /bot\b|bot\/|crawler|crawl|spider|slurp|mediapartners|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegram|discord|slack|skype|embedly|preview|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|statuscake|curl\/|wget\/|python|java\/|okhttp|go-http-client|node-fetch|axios|undici|httpclient|libwww|scrapy|feedfetcher|validator|bingpreview|yandex|baiduspider|duckduckgo|applebot|petalbot|semrush|ahrefs|mj12|dotbot|bytespider|gptbot|claudebot|anthropic|perplexity|ccbot|chatgpt/i;

export function esBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  if (ua.length < 10) return true;
  return PATRON_BOT.test(ua);
}

/** ¿Es una precarga (el navegador o Next piden la página antes de que la persona la abra)? */
export function esPrefetch(cabeceras: { get(nombre: string): string | null }): boolean {
  const purpose = `${cabeceras.get("purpose") ?? ""} ${cabeceras.get("sec-purpose") ?? ""} ${cabeceras.get("x-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender") || purpose.includes("preview")) return true;
  if (cabeceras.get("next-router-prefetch")) return true;
  if ((cabeceras.get("x-moz") ?? "").toLowerCase() === "prefetch") return true;
  return false;
}

/**
 * El beacon sale del mismo sitio: un pedido que el navegador marca como de otro sitio no se
 * cuenta (alguien inflando números desde otra página). Sin la cabecera (navegadores viejos), pasa.
 */
export function esDeOtroSitio(cabeceras: { get(nombre: string): string | null }): boolean {
  const site = (cabeceras.get("sec-fetch-site") ?? "").toLowerCase();
  return site === "cross-site";
}

const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día (`AAAA-MM-DD`) de un instante, en hora argentina. */
export function diaArgentino(instante: Date): string {
  return FORMATO_DIA.format(instante);
}

/** El día como lo guarda Prisma en una columna `DATE` (medianoche UTC de ese día). */
export function diaComoFecha(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/** El día `n` días antes (o después, con `n` negativo) de `dia`. */
export function sumarDias(dia: string, n: number): string {
  const d = diaComoFecha(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const PERIODOS_VISITAS = [7, 30, 90] as const;
export type PeriodoVisitas = (typeof PERIODOS_VISITAS)[number];

export function periodoDeVisitas(valor: unknown): PeriodoVisitas {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return (PERIODOS_VISITAS as readonly number[]).includes(n) ? (n as PeriodoVisitas) : 30;
}

export type FilaVisita = { ruta: string; dia: string; visitas: number };
export type ResumenVisitas = {
  total: number;
  /** De más a menos visitada. */
  porPagina: Array<{ ruta: string; visitas: number }>;
  /** Un elemento por día del período, del más viejo a hoy (los días sin visitas en cero). */
  porDia: Array<{ dia: string; visitas: number }>;
};

/** Suma las filas de los últimos `dias` días que terminan en `hoy` (inclusive). */
export function resumirVisitas(filas: readonly FilaVisita[], dias: number, hoy: string): ResumenVisitas {
  const desde = sumarDias(hoy, -(dias - 1));
  const porRuta = new Map<string, number>();
  const porDiaMapa = new Map<string, number>();
  let total = 0;
  for (const f of filas) {
    if (f.dia < desde || f.dia > hoy) continue;
    total += f.visitas;
    porRuta.set(f.ruta, (porRuta.get(f.ruta) ?? 0) + f.visitas);
    porDiaMapa.set(f.dia, (porDiaMapa.get(f.dia) ?? 0) + f.visitas);
  }
  const porDia: ResumenVisitas["porDia"] = [];
  for (let i = 0; i < dias; i++) {
    const dia = sumarDias(desde, i);
    porDia.push({ dia, visitas: porDiaMapa.get(dia) ?? 0 });
  }
  const porPagina = [...porRuta.entries()]
    .map(([ruta, visitas]) => ({ ruta, visitas }))
    .sort((a, b) => b.visitas - a.visitas || a.ruta.localeCompare(b.ruta));
  return { total, porPagina, porDia };
}

/** Visitas por página propia (clave = slug; `""` = portada), para mostrarlas en el constructor. */
export function visitasPorSlug(porPagina: ResumenVisitas["porPagina"]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { ruta, visitas } of porPagina) {
    if (ruta === "/") out[""] = visitas;
    else if (!ruta.slice(1).includes("/")) out[ruta.slice(1)] = visitas;
  }
  return out;
}
