/**
 * Portfolios del estudio (spec 2026-11-15): lo que la vendedora busca para mandarle al cliente.
 * Módulo PURO: validar etiquetas y presentaciones, armar el enlace público de un trabajo, decidir si
 * se puede compartir y agrupar por rubro → estilo.
 */

export type Enlace = { titulo: string; url: string };
export type Rubro = { id: string; nombre: string; orden: number; enlaces: Enlace[] };

export type PortfolioTrabajo = {
  id: string;
  titulo: string;
  lugar: string | null;
  fecha: Date | null;
  destacado: boolean;
  portadaUrl: string | null;
  rubroId: string | null;
  estilos: string[];
  compartible: boolean;
  /** Por qué no se puede compartir (sólo lo ve quien edita Trabajos); null si se puede. */
  motivo: string | null;
  url: string | null;
};

export type GrupoEstilo = { estilo: string; trabajos: PortfolioTrabajo[] };
export type GrupoRubro = { rubro: Rubro; estilos: GrupoEstilo[]; total: number };

/** El grupo de los trabajos de un rubro que no tienen estilo. Siempre al final del rubro. */
export const OTROS = "Otros";

export const MAX_ESTILOS = 6;
export const MAX_LARGO_ESTILO = 40;
export const MAX_ENLACES = 10;
export const MAX_TITULO_ENLACE = 80;
export const MAX_NOMBRE_RUBRO = 60;

const espacios = (s: string) => s.replace(/\s+/g, " ").trim();

/** Recorta, une espacios, saca repetidos (sin distinguir mayúsculas) y aplica los topes. */
export function normalizarEstilos(crudo: unknown): string[] {
  if (!Array.isArray(crudo)) return [];
  const out: string[] = [];
  const vistos = new Set<string>();
  for (const x of crudo) {
    if (typeof x !== "string") continue;
    const e = espacios(x);
    if (!e || e.length > MAX_LARGO_ESTILO) continue;
    const clave = e.toLocaleLowerCase("es");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(e);
    if (out.length >= MAX_ESTILOS) break;
  }
  return out;
}

function esHttps(url: string): boolean {
  if (/\s/.test(url)) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.length > 0 && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Presentaciones de venta: título 1–80, `https://` válido, máx. 10. Lo inválido se descarta. */
export function validarEnlaces(crudo: unknown): Enlace[] {
  if (!Array.isArray(crudo)) return [];
  const out: Enlace[] = [];
  for (const x of crudo) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.titulo !== "string" || typeof r.url !== "string") continue;
    const titulo = espacios(r.titulo);
    const url = r.url.trim();
    if (!titulo || titulo.length > MAX_TITULO_ENLACE || !esHttps(url)) continue;
    out.push({ titulo, url });
    if (out.length >= MAX_ENLACES) break;
  }
  return out;
}

export function validarNombreRubro(n: unknown): string | null {
  if (typeof n !== "string") return null;
  const v = espacios(n);
  return v && v.length <= MAX_NOMBRE_RUBRO ? v : null;
}

/** Enlace público absoluto: en el dominio propio si está conectado; si no, en `/w/<slug>`. */
export function urlDelTrabajo(i: {
  customDomain: string | null;
  appOrigin: string;
  slug: string | null;
  categoriaSlug: string;
  trabajoSlug: string;
}): string | null {
  const ruta = `/trabajos/${encodeURIComponent(i.categoriaSlug)}/${encodeURIComponent(i.trabajoSlug)}`;
  if (i.customDomain) return `https://${i.customDomain}${ruta}`;
  const origen = i.appOrigin.replace(/\/+$/, "");
  if (!origen || !i.slug) return null;
  return `${origen}/w/${encodeURIComponent(i.slug)}${ruta}`;
}

/** null = se puede compartir (el enlace abre). Si no, el motivo, en palabras de la pantalla. */
export function motivoNoCompartible(i: {
  estado: string;
  categoriaVisible: boolean | null;
  sitioPublicado: boolean;
  url: string | null;
}): string | null {
  if (i.estado !== "PUBLICADO") return "Es un borrador";
  if (i.categoriaVisible === null) return "No tiene categoría";
  if (!i.categoriaVisible) return "Su categoría está oculta en el sitio";
  if (!i.sitioPublicado) return "El sitio no está publicado";
  if (!i.url) return "El sitio no tiene dirección pública";
  return null;
}

function compararTrabajos(a: PortfolioTrabajo, b: PortfolioTrabajo): number {
  if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
  const fa = a.fecha?.getTime() ?? null;
  const fb = b.fecha?.getTime() ?? null;
  if (fa !== fb) {
    if (fa === null) return 1;
    if (fb === null) return -1;
    return fb - fa;
  }
  return a.titulo.localeCompare(b.titulo, "es");
}

/**
 * Rubros en su orden (también los vacíos, con total 0); dentro, estilos en el orden en que aparecen
 * en los trabajos ya ordenados, y «Otros» al final. Un trabajo con varios estilos va en cada uno.
 * Sin rubro, o con un rubro que ya no existe: `sinEtiquetar`.
 */
export function agrupar(rubros: Rubro[], trabajos: PortfolioTrabajo[]): { grupos: GrupoRubro[]; sinEtiquetar: PortfolioTrabajo[] } {
  const ordenados = [...trabajos].sort(compararTrabajos);
  const ids = new Set(rubros.map((r) => r.id));
  const porRubro = new Map<string, PortfolioTrabajo[]>();
  const sinEtiquetar: PortfolioTrabajo[] = [];
  for (const tr of ordenados) {
    if (!tr.rubroId || !ids.has(tr.rubroId)) {
      sinEtiquetar.push(tr);
      continue;
    }
    const l = porRubro.get(tr.rubroId) ?? [];
    l.push(tr);
    porRubro.set(tr.rubroId, l);
  }
  const grupos = [...rubros]
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))
    .map((rubro): GrupoRubro => {
      const lista = porRubro.get(rubro.id) ?? [];
      // Clave sin mayúsculas ni espacios de más: «Fiesta» y «fiesta» son el mismo grupo (se muestra la primera forma).
      const estilos = new Map<string, GrupoEstilo>();
      const otros: PortfolioTrabajo[] = [];
      for (const tr of lista) {
        if (tr.estilos.length === 0) otros.push(tr);
        for (const e of tr.estilos) {
          const clave = espacios(e).toLocaleLowerCase("es");
          const g = estilos.get(clave) ?? { estilo: espacios(e), trabajos: [] };
          if (!g.trabajos.includes(tr)) g.trabajos.push(tr);
          estilos.set(clave, g);
        }
      }
      const grupos = [...estilos.values()];
      if (otros.length) grupos.push({ estilo: OTROS, trabajos: otros });
      return { rubro, estilos: grupos, total: lista.length };
    });
  return { grupos, sinEtiquetar };
}
