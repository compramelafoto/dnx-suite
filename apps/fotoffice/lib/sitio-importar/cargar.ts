import { createHash } from "node:crypto";
import { formatContentValidationError, normalizeContentSlug, parseContentPostCreate } from "@repo/content";
import { collectImageSources, replaceImageSources } from "@/lib/blog/localize-images-core";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { prefijoFotoAutor, validarTestimonio } from "@/lib/testimonios/dominio";
import { MAX_FOTOS_POR_TRABAJO, SLUG_TRABAJO_MAX, prefijoFotosTrabajo, slugDeTitulo } from "@/lib/trabajos/reglas";
import {
  createEmptyBlock,
  parseWebsiteSections,
  websiteBlockSchema,
  websitePageContentSchema,
  websiteSectionsSchema,
  type WebsiteBlock,
  type WebsiteBlockType,
  type WebsiteSections,
} from "@/lib/website/blocks";
import { BLOG_PUBLIC_PAGE_KEY, TESTIMONIOS_PUBLIC_PAGE_KEY, TRABAJOS_PUBLIC_PAGE_KEY } from "@/lib/website/constants";
import { findPageBySlug, validatePageSlug } from "@/lib/website/pages";
import { PUBLIC_MODULE_PAGES } from "@/lib/website/public-modules";
import { destinoBajoPrefijo, normalizarRuta, type ReglaRedireccion } from "@/lib/website/redirecciones-reglas";
import { sanitizeBlocksForSave } from "@/lib/website/rich-text-sanitize";
import { parseSiteMenu, SITE_MENU_VERSION, type SiteMenu, type SiteMenuEntry } from "@/lib/website/site-menu";
import { leerArticulo, type ArticuloAlboom } from "./alboom/articulo";
import { urlOriginal } from "./alboom/fotos";
import { leerGaleria } from "./alboom/galeria";
import { idDeRuta, leerListadoGalerias, leerListadoTrabajos, leerSitemap, leerTrabajosDeLaPortada } from "./alboom/listados";
import { leerPagina, type PaginaAlboom } from "./alboom/pagina";
import { leerTestimonios, type TestimonioAlboom } from "./alboom/testimonios";
import { leerTrabajo } from "./alboom/trabajo";
import type { DestinoImportacion, FotoDeTrabajoNueva } from "./destino";
import {
  ARTICULOS_DNX,
  AUTOR_BLOG,
  CATEGORIA_DE_GALERIA,
  CATEGORIAS_TRABAJOS,
  CONSENTIMIENTO_IMPORTADO,
  CONTACTO_DNX,
  FOTOS_DEL_CARRUSEL,
  LOGO_ALBOOM_DNX,
  ORIGEN_IMPORTACION,
  PAGINAS_DNX,
  REDIRECCIONES_FIJAS,
  RUTAS_CONOCIDAS,
  SLUG_PUBLICO_DNX,
  SLUGS_LIMPIOS,
  TIENDA_ONLINE_DNX,
  type PaginaAImportar,
} from "./dnx";
import { LADO_MAXIMO_AVATAR_PX, prefijoImagenesBlog, prefijoImagenesPagina, type CopiaHecha, type ResultadoCopia } from "./fotos-r2";
import type { FuenteAlboom } from "./fuente";
import { htmlArticuloAContenido, paginaABloques, type JSONContent, type MapaEnlaces } from "./transformar";

/**
 * El importador de Alboom Prosite: lee el sitio público viejo, lo transforma y lo carga en
 * FOTOFFICE (blog, Trabajos, Testimonios, páginas, portada y menú del borrador del sitio,
 * redirecciones y logo). Devuelve un informe con todo lo que hizo y lo que no pudo.
 *
 * - Idempotente: antes de crear algo se busca (artículos por slug, trabajos y testimonios por su id
 *   de Alboom, páginas por slug, redirecciones por ruta). Una segunda corrida no crea nada; si la
 *   primera se cortó a mitad, completa las fotos que le falten a un trabajo.
 * - Los artículos quedan en BORRADOR (el blog ya es público); Daniel los publica con «Publicar
 *   contenido importado». Trabajos y testimonios quedan PUBLICADOS (no se ven hasta publicar el
 *   sitio). Las páginas, la portada y el menú van al BORRADOR del sitio: nunca se publica el sitio.
 * - Una foto que falla no frena nada: el artículo o el trabajo se crea igual y la foto va al informe.
 *
 * Quién escribe lo decide `deps`: en simulación, un destino en memoria y una copia de fotos de
 * mentira (no se escribe ni se sube nada); con `--aplicar`, la base y R2 de verdad. Ver el script
 * `packages/db/prisma/scripts/ops-sitio-importar-alboom-prosite.ts`.
 */

export type OpcionesImportacion = {
  workspaceId: string;
  base: string;
  /** Sólo para el informe: quién escribe lo deciden `deps`. */
  aplicar: boolean;
  /** Slug público si el destino no lo sabe (simulación sin base). */
  slugPublico?: string;
  articulos?: readonly string[];
  paginas?: readonly PaginaAImportar[];
};

export type CopiarFoto = (urlOrigen: string, prefijo: string, opciones?: { ladoMaximo?: number }) => Promise<ResultadoCopia>;

export type DepsImportacion = {
  fuente: FuenteAlboom;
  destino: DestinoImportacion;
  copiarFoto: CopiarFoto;
  ahora?: () => Date;
  /** Avance en la consola (una línea por paso). */
  avisar?: (mensaje: string) => void;
};

export type EstadoItem = "creado" | "existente" | "fallido" | "completado";

export type Contador = { creados: number; existentes: number; fallidos: number };

export type Informe = {
  modo: "simulacion" | "aplicado";
  fecha: string;
  base: string;
  workspaceId: string;
  slugPublico: string;
  articulos: Contador & { detalle: Array<{ alboomId: string; titulo: string; slug: string; estado: EstadoItem; error?: string }> };
  autorBlog: "creado" | "existente";
  categoriasBlog: Contador;
  categoriasTrabajos: Contador;
  trabajos: Contador & {
    completados: number;
    detalle: Array<{ alboomId: string; titulo: string; ruta: string; categoria: string; slug: string; fotos: number; videos: number; estado: EstadoItem; error?: string }>;
  };
  testimonios: Contador & { detalle: Array<{ nombre: string; estado: EstadoItem; trabajo?: string; error?: string }> };
  paginas: Contador & { detalle: Array<{ slug: string; alboom: string; bloques: number; estado: EstadoItem; error?: string }> };
  portada: { estado: "creada" | "existente"; bloquesAnteriores: number };
  menu: "creado" | "existente";
  logo: "copiado" | "ya tenía" | "fallido";
  redirecciones: { total: number; creadas: number };
  fotos: { copiadas: number; fallidas: Array<{ donde: string; url: string; error: string }> };
  landingsNoMigradas: Array<{ ruta: string; url: string }>;
  avisos: string[];
};

const ID_PORTADA = "alboom_portada";
const ID_MENU_TIENDA = "link:tienda-online";
const SLUG_ARTICULO_MAX = 60;

/** Fecha de Alboom (`aaaa-mm-ddThh:mm`, hora argentina) → instante UTC (+3 h). */
export function fechaArgentinaAUtc(fechaLocal: string): Date {
  return new Date(`${fechaLocal}:00-03:00`);
}

/** Corta un slug en el último guion que entre en `max` (nunca a mitad de palabra si se puede). */
export function recortarSlug(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const corte = slug.slice(0, max + 1).lastIndexOf("-");
  return (corte > max / 2 ? slug.slice(0, corte) : slug.slice(0, max)).replace(/-+$/, "");
}

/** El slug nuevo de un artículo: el limpio del plan, o el de Alboom sin el número. */
export function slugDeArticulo(a: Pick<ArticuloAlboom, "alboomId" | "slugAlboom" | "titulo">): string {
  const limpio = SLUGS_LIMPIOS[a.alboomId];
  if (limpio) return limpio;
  return recortarSlug(normalizeContentSlug(a.slugAlboom || a.titulo), SLUG_ARTICULO_MAX);
}

/** Id estable de un testimonio de Alboom (no tienen número): hash del nombre y el texto. */
export function idDeTestimonio(t: Pick<TestimonioAlboom, "nombre" | "texto">): string {
  return `alboom-${createHash("sha256").update(`${t.nombre}\n${t.texto}`).digest("hex").slice(0, 16)}`;
}

type ItemTrabajo = {
  alboomId: string;
  ruta: string;
  esGaleria: boolean;
  titulo: string;
  categoriaAlboom: string;
  categoriaNombreAlboom: string | null;
  slugAlboom: string;
  lugar: string | null;
  fecha: string | null;
  descripcionHtml: string;
  fotos: string[];
  videos: string[];
  // Lo que se decide al planificar.
  slug: string;
  categoria: string;
  existente: { id: string; origenesFotos: string[]; portadaUrl: string | null } | null;
};

function informeVacio(o: OpcionesImportacion, slugPublico: string, ahora: Date): Informe {
  const c = (): Contador => ({ creados: 0, existentes: 0, fallidos: 0 });
  return {
    modo: o.aplicar ? "aplicado" : "simulacion",
    fecha: ahora.toISOString(),
    base: o.base,
    workspaceId: o.workspaceId,
    slugPublico,
    articulos: { ...c(), detalle: [] },
    autorBlog: "existente",
    categoriasBlog: c(),
    categoriasTrabajos: c(),
    trabajos: { ...c(), completados: 0, detalle: [] },
    testimonios: { ...c(), detalle: [] },
    paginas: { ...c(), detalle: [] },
    portada: { estado: "existente", bloquesAnteriores: 0 },
    menu: "existente",
    logo: "ya tenía",
    redirecciones: { total: 0, creadas: 0 },
    fotos: { copiadas: 0, fallidas: [] },
    landingsNoMigradas: [],
    avisos: [],
  };
}

const mensaje = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function importarSitioAlboom(opciones: OpcionesImportacion, deps: DepsImportacion): Promise<Informe> {
  const { fuente, destino } = deps;
  const avisar = deps.avisar ?? (() => {});
  const ws = opciones.workspaceId;
  const base = opciones.base.replace(/\/+$/, "");
  const slugPublico = (await destino.slugPublico()) ?? opciones.slugPublico ?? SLUG_PUBLICO_DNX;
  const prefijoSitio = `/w/${slugPublico}`;
  const informe = informeVacio(opciones, slugPublico, deps.ahora?.() ?? new Date());

  // ── Fotos: cada copia pasa por acá para contar y anotar las fallidas ──────────────────────────
  const keysCopiadas = new Set<string>();
  async function copiar(url: string, prefijo: string, donde: string, opcionesCopia?: { ladoMaximo?: number }): Promise<CopiaHecha | null> {
    const r = await deps.copiarFoto(url, prefijo, opcionesCopia);
    if ("error" in r) {
      informe.fotos.fallidas.push({ donde, url, error: r.error });
      return null;
    }
    if (!keysCopiadas.has(r.key)) {
      keysCopiadas.add(r.key);
      informe.fotos.copiadas++;
    }
    return r;
  }

  async function traerHtml(ruta: string, ajax = false): Promise<string | { error: string }> {
    try {
      const r = await fuente.traer(ruta, { ajax });
      if (r.status !== 200) return { error: `respondió ${r.status}` };
      return r.html;
    } catch (err) {
      return { error: mensaje(err) };
    }
  }

  // ── 1. Leer el sitio viejo ────────────────────────────────────────────────────────────────────
  avisar("Leyendo la portada, el sitemap y los listados…");
  const portada = await traerHtml("/");
  if (typeof portada !== "string") throw new Error(`No se pudo leer la portada de ${base}: ${portada.error}`);
  const sitemapXml = await traerHtml("/sitemap.xml");
  const sitemap = typeof sitemapXml === "string" ? leerSitemap(sitemapXml) : [];
  if (typeof sitemapXml !== "string") informe.avisos.push(`No se pudo leer el sitemap (${sitemapXml.error}): no se listan las landings.`);

  const rutasTrabajos: string[] = [];
  const listado = await traerHtml("/portfolio");
  if (typeof listado === "string") {
    const primera = leerListadoTrabajos(listado);
    rutasTrabajos.push(...primera.rutas);
    for (let n = 2; n <= primera.paginas; n++) {
      const pagina = await traerHtml(`/portfolio?page=${n}`, true);
      if (typeof pagina === "string") rutasTrabajos.push(...leerListadoTrabajos(pagina).rutas.filter((r) => !rutasTrabajos.includes(r)));
      else informe.avisos.push(`No se pudo leer la página ${n} del listado de trabajos (${pagina.error}).`);
    }
  } else informe.avisos.push(`No se pudo leer el listado de trabajos (${listado.error}).`);

  const galerias = await traerHtml("/galerias");
  const rutasGalerias = typeof galerias === "string" ? leerListadoGalerias(galerias) : [];
  if (typeof galerias !== "string") informe.avisos.push(`No se pudo leer el listado de galerías (${galerias.error}).`);

  avisar(`Leyendo ${rutasTrabajos.length} trabajos y ${rutasGalerias.length} galerías…`);
  const items: ItemTrabajo[] = [];
  const falloTrabajo = (ruta: string, error: string) => {
    informe.trabajos.fallidos++;
    informe.trabajos.detalle.push({ alboomId: idDeRuta(ruta) ?? "?", titulo: ruta, ruta, categoria: "", slug: "", fotos: 0, videos: 0, estado: "fallido", error });
  };
  for (const ruta of rutasTrabajos) {
    const html = await traerHtml(ruta);
    if (typeof html !== "string") {
      falloTrabajo(ruta, html.error);
      continue;
    }
    try {
      const t = leerTrabajo(html, `${base}${ruta}`);
      items.push({
        alboomId: t.alboomId,
        ruta,
        esGaleria: false,
        titulo: t.titulo,
        categoriaAlboom: t.categoriaSlug,
        categoriaNombreAlboom: t.categoriaNombre,
        slugAlboom: t.slugAlboom,
        lugar: t.lugar,
        fecha: t.fecha,
        descripcionHtml: t.descripcionHtml,
        fotos: t.fotos,
        videos: t.videos,
        slug: "",
        categoria: "",
        existente: null,
      });
    } catch (err) {
      falloTrabajo(ruta, mensaje(err));
    }
  }
  for (const ruta of rutasGalerias) {
    const html = await traerHtml(ruta);
    if (typeof html !== "string") {
      falloTrabajo(ruta, html.error);
      continue;
    }
    try {
      const g = leerGaleria(html, `${base}${ruta}`);
      items.push({
        alboomId: g.alboomId,
        ruta,
        esGaleria: true,
        titulo: g.titulo,
        categoriaAlboom: "",
        categoriaNombreAlboom: null,
        slugAlboom: g.slugAlboom,
        lugar: null,
        fecha: null,
        descripcionHtml: "",
        fotos: g.fotos,
        videos: g.videos,
        slug: "",
        categoria: CATEGORIA_DE_GALERIA[g.alboomId] ?? "",
        existente: null,
      });
    } catch (err) {
      falloTrabajo(ruta, mensaje(err));
    }
  }

  const listaArticulos = opciones.articulos ?? ARTICULOS_DNX;
  avisar(`Leyendo ${listaArticulos.length} artículos…`);
  const articulos: ArticuloAlboom[] = [];
  for (const id of listaArticulos) {
    const ruta = `/post.php?id=${id}`;
    const html = await traerHtml(ruta);
    try {
      if (typeof html !== "string") throw new Error(html.error);
      articulos.push(leerArticulo(html, `${base}${ruta}`));
    } catch (err) {
      informe.articulos.fallidos++;
      informe.articulos.detalle.push({ alboomId: id, titulo: "", slug: "", estado: "fallido", error: mensaje(err) });
    }
  }

  const listaPaginas = opciones.paginas ?? PAGINAS_DNX;
  avisar(`Leyendo ${listaPaginas.length} páginas…`);
  const paginas: Array<{ def: PaginaAImportar; pagina: PaginaAlboom }> = [];
  for (const def of listaPaginas) {
    const html = await traerHtml(def.alboom);
    try {
      if (typeof html !== "string") throw new Error(html.error === "respondió 404" ? "no está en línea en Alboom (404)" : html.error);
      paginas.push({ def, pagina: leerPagina(html) });
    } catch (err) {
      informe.paginas.fallidos++;
      informe.paginas.detalle.push({ slug: def.slug, alboom: def.alboom, bloques: 0, estado: "fallido", error: mensaje(err) });
    }
  }
  const testimonios = leerTestimonios(portada);

  // ── 2. Direcciones nuevas: categorías, slugs y el mapa de enlaces ───────────────────────────────
  avisar("Armando las direcciones nuevas…");
  const categoriaPorSlug = new Map<string, string>(); // slug nuevo → id
  const slugDeCategoriaPorId = new Map<string, string>();
  async function asegurarCategoria(nombre: string, slug: string) {
    if (categoriaPorSlug.has(slug)) return;
    const c = await destino.categoriaTrabajo(nombre, slug);
    categoriaPorSlug.set(slug, c.id);
    slugDeCategoriaPorId.set(c.id, slug);
    if (c.creada) informe.categoriasTrabajos.creados++;
    else informe.categoriasTrabajos.existentes++;
  }
  for (const c of CATEGORIAS_TRABAJOS) await asegurarCategoria(c.nombre, c.slug);
  const categoriaDeAlboom = new Map<string, string>();
  for (const c of CATEGORIAS_TRABAJOS) for (const a of c.alboom) categoriaDeAlboom.set(a, c.slug);

  const ocupados = new Set(await destino.slugsDeTrabajos());
  for (const it of items) {
    if (!it.esGaleria) {
      let cat = categoriaDeAlboom.get(it.categoriaAlboom);
      if (!cat) {
        // Una categoría de Alboom que no está en la lista: se crea con su nombre.
        const nombre = (it.categoriaNombreAlboom ?? it.categoriaAlboom).replace(/!+$/, "").trim() || "Otros";
        cat = slugDeTitulo(nombre) || "otros";
        await asegurarCategoria(nombre, cat);
        categoriaDeAlboom.set(it.categoriaAlboom, cat);
        informe.avisos.push(`La categoría de Alboom «${it.categoriaAlboom}» no estaba prevista: se creó «${nombre}».`);
      }
      it.categoria = cat;
    } else if (!it.categoria) {
      it.categoria = "books";
      informe.avisos.push(`La galería ${it.alboomId} no tenía categoría prevista: va a Books.`);
    }
    const existente = await destino.trabajoPorOrigen(it.alboomId);
    if (existente) {
      it.slug = existente.slug;
      it.categoria = (existente.categoriaId && slugDeCategoriaPorId.get(existente.categoriaId)) || it.categoria;
      it.existente = { id: existente.id, origenesFotos: existente.origenesFotos, portadaUrl: existente.portadaUrl };
      continue;
    }
    let slug = it.esGaleria ? slugDeTitulo(`galeria ${it.titulo}`) : it.slugAlboom && it.slugAlboom !== "sin-titulo" ? it.slugAlboom : slugDeTitulo(it.titulo);
    slug = recortarSlug(slug.replace(/_/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, ""), SLUG_TRABAJO_MAX);
    if (!slug || slug === "sin-titulo") slug = `trabajo-${it.alboomId}`;
    if (ocupados.has(slug)) slug = `${recortarSlug(slug, SLUG_TRABAJO_MAX - it.alboomId.length - 1)}-${it.alboomId}`;
    ocupados.add(slug);
    it.slug = slug;
  }

  const slugsArticulo = new Map(articulos.map((a) => [a.alboomId, slugDeArticulo(a)]));
  const reglas = armarRedirecciones({ articulos, slugsArticulo, items, paginas: listaPaginas, paginasLeidas: new Set(paginas.map((p) => p.def.slug)) });
  for (const ruta of sitemap) {
    if (esLanding(ruta) && !reglas.some((r) => r.desde === normalizarRuta(ruta))) {
      informe.landingsNoMigradas.push({ ruta, url: `${base}${ruta}` });
      reglas.push({ desde: normalizarRuta(ruta), hacia: "/trabajos", codigo: 301 });
    }
  }
  const mapaEnlaces = armarMapaEnlaces(reglas, items, prefijoSitio);

  // ── 3. Blog ────────────────────────────────────────────────────────────────────────────────────
  avisar("Cargando el blog…");
  const autor = await destino.autorBlog(AUTOR_BLOG.nombre, AUTOR_BLOG.slug);
  informe.autorBlog = autor.creado ? "creado" : "existente";
  for (const a of articulos) {
    const slug = slugsArticulo.get(a.alboomId)!;
    const fila = { alboomId: a.alboomId, titulo: a.titulo, slug };
    try {
      if (await destino.articuloPorSlug(slug)) {
        informe.articulos.existentes++;
        informe.articulos.detalle.push({ ...fila, estado: "existente" });
        continue;
      }
      const donde = `Artículo ${a.alboomId} «${a.titulo}»`;
      let contenido: JSONContent = await htmlArticuloAContenido(a.cuerpoHtml, mapaEnlaces);
      const reemplazos = new Map<string, string>();
      for (const src of collectImageSources(contenido)) {
        if (reemplazos.has(src) || !/^https?:\/\//i.test(src)) continue;
        const copia = await copiar(urlOriginal(src), prefijoImagenesBlog(ws, "media"), donde);
        if (copia) {
          reemplazos.set(src, copia.url);
          await registrarMedia(copia, src);
        }
      }
      if (reemplazos.size) contenido = replaceImageSources(contenido, reemplazos) as JSONContent;
      let heroImageUrl: string | null = null;
      if (a.portadaUrl) {
        const copia = await copiar(a.portadaUrl, prefijoImagenesBlog(ws, "hero"), `${donde} (portada)`);
        if (copia) {
          heroImageUrl = copia.url;
          await registrarMedia(copia, a.portadaUrl);
        }
      }
      let categoryId: number | null = null;
      if (a.categorias[0]) {
        const nombre = a.categorias[0];
        const c = await destino.categoriaBlog(nombre, normalizeContentSlug(nombre) || "general");
        if (c.creada) informe.categoriasBlog.creados++;
        else informe.categoriasBlog.existentes++;
        categoryId = c.id;
      }
      const publicado = fechaArgentinaAUtc(a.fechaLocal);
      const parsed = parseContentPostCreate({
        title: a.titulo.slice(0, 200),
        slug,
        contentJson: contenido,
        heroImageUrl,
        status: "DRAFT",
        type: "BLOG",
        publishedAt: publicado,
        authorId: autor.id,
        categoryId,
      });
      if (!parsed.success) throw new Error(formatContentValidationError(parsed.error));
      await destino.crearArticulo({ data: parsed.data, createdAt: publicado });
      informe.articulos.creados++;
      informe.articulos.detalle.push({ ...fila, estado: "creado" });
    } catch (err) {
      informe.articulos.fallidos++;
      informe.articulos.detalle.push({ ...fila, estado: "fallido", error: mensaje(err) });
    }
  }

  async function registrarMedia(copia: CopiaHecha, origen: string) {
    let filename = "imagen";
    try {
      filename = decodeURIComponent(new URL(urlOriginal(origen)).pathname.split("/").pop() || "imagen");
    } catch {
      // queda «imagen»
    }
    const ext = copia.key.split(".").pop()?.toLowerCase();
    const mimeType = copia.tipo ?? (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
    await destino.registrarMediaBlog({ url: copia.url, r2Key: copia.key, filename: filename.slice(0, 200), mimeType, sizeBytes: copia.peso ?? 0 });
  }

  // ── 4. Trabajos ────────────────────────────────────────────────────────────────────────────────
  avisar(`Cargando ${items.length} trabajos…`);
  const destacados = new Set(leerTrabajosDeLaPortada(portada).map(idDeRuta).filter(Boolean).slice(0, FOTOS_DEL_CARRUSEL) as string[]);
  const trabajoPorAlboom = new Map<string, { id: string; portadaUrl: string | null }>();
  for (const it of items) {
    const donde = `${it.esGaleria ? "Galería" : "Trabajo"} ${it.alboomId} «${it.titulo}»`;
    const fila = { alboomId: it.alboomId, titulo: it.titulo, ruta: it.ruta, categoria: it.categoria, slug: it.slug };
    try {
      let trabajoId: string;
      let creado = false;
      if (it.existente) {
        trabajoId = it.existente.id;
      } else {
        const r = await destino.crearTrabajo({
          titulo: it.titulo.slice(0, 200),
          slug: it.slug,
          categoriaId: categoriaPorSlug.get(it.categoria) ?? null,
          lugar: it.lugar,
          fecha: it.fecha ? new Date(`${it.fecha}T00:00:00Z`) : null,
          descripcionHtml: it.descripcionHtml.trim() || null,
          destacado: destacados.has(it.alboomId),
          origenExternoId: it.alboomId,
        });
        trabajoId = r.id;
        creado = true;
      }
      // Sólo lo que falta: en una segunda corrida no se vuelve a pedir nada de lo que ya está.
      const yaEstan = new Set(it.existente?.origenesFotos ?? []);
      const fotosQueFaltan = it.fotos.filter((u) => !yaEstan.has(u));
      const videosQueFaltan = it.videos.map((v) => v.replace(/^http:\/\//i, "https://")).filter((v) => !yaEstan.has(v) && /^https:\/\//i.test(v));
      const lugarLibre = MAX_FOTOS_POR_TRABAJO - yaEstan.size;
      if (fotosQueFaltan.length + videosQueFaltan.length > lugarLibre) {
        informe.avisos.push(`${donde}: tiene más de ${MAX_FOTOS_POR_TRABAJO} fotos; se cargan las primeras.`);
      }
      const nuevas: FotoDeTrabajoNueva[] = [];
      for (const url of fotosQueFaltan.slice(0, Math.max(lugarLibre - videosQueFaltan.length, 0))) {
        const copia = await copiar(url, prefijoFotosTrabajo(ws, trabajoId), donde);
        if (copia) nuevas.push({ tipo: "FOTO", url: copia.url, r2Key: copia.key, ancho: copia.ancho, alto: copia.alto, origenUrl: url });
      }
      for (const url of videosQueFaltan.slice(0, lugarLibre)) {
        nuevas.push({ tipo: "VIDEO_URL", url, r2Key: null, ancho: null, alto: null, origenUrl: url });
      }
      const agregadas = nuevas.length ? await destino.agregarFotosTrabajo(trabajoId, nuevas) : 0;
      if (creado) {
        await destino.publicarTrabajo(trabajoId);
        informe.trabajos.creados++;
      } else if (agregadas > 0) informe.trabajos.completados++;
      else informe.trabajos.existentes++;
      trabajoPorAlboom.set(it.alboomId, { id: trabajoId, portadaUrl: it.existente?.portadaUrl ?? nuevas.find((f) => f.tipo === "FOTO")?.url ?? null });
      informe.trabajos.detalle.push({
        ...fila,
        fotos: it.fotos.length,
        videos: it.videos.length,
        estado: creado ? "creado" : agregadas > 0 ? "completado" : "existente",
      });
    } catch (err) {
      informe.trabajos.fallidos++;
      informe.trabajos.detalle.push({ ...fila, fotos: it.fotos.length, videos: it.videos.length, estado: "fallido", error: mensaje(err) });
    }
  }

  // ── 5. Testimonios ─────────────────────────────────────────────────────────────────────────────
  avisar(`Cargando ${testimonios.length} testimonios…`);
  for (const [orden, t] of testimonios.entries()) {
    const origenExternoId = idDeTestimonio(t);
    try {
      if (await destino.testimonioPorOrigen(origenExternoId)) {
        informe.testimonios.existentes++;
        informe.testimonios.detalle.push({ nombre: t.nombre, estado: "existente" });
        continue;
      }
      const idTrabajo = t.trabajoAlboomUrl ? (idDeRuta(new URL(t.trabajoAlboomUrl).pathname) ?? new URL(t.trabajoAlboomUrl).searchParams.get("id")) : null;
      const trabajo = idTrabajo ? trabajoPorAlboom.get(idTrabajo) : undefined;
      // Un enlace al propio sitio viejo no es «la red del autor»: queda sólo como trabajo atado.
      let v = validarTestimonio({ texto: t.texto, autorNombre: t.nombre, autorEnlace: t.trabajoAlboomUrl ? null : t.enlace });
      if (!v.ok && v.errores.autorEnlace) v = validarTestimonio({ texto: t.texto, autorNombre: t.nombre });
      if (!v.ok) throw new Error(Object.values(v.errores).join(" "));
      const foto = t.fotoUrl ? await copiar(t.fotoUrl, prefijoFotoAutor(ws), `Testimonio de ${t.nombre}`, { ladoMaximo: LADO_MAXIMO_AVATAR_PX }) : null;
      await destino.crearTestimonio({
        datos: v.datos,
        trabajoId: trabajo?.id ?? null,
        autorFotoUrl: foto?.url ?? null,
        autorFotoKey: foto?.key ?? null,
        origenExternoId,
        consentimientoTexto: CONSENTIMIENTO_IMPORTADO,
        orden,
      });
      informe.testimonios.creados++;
      informe.testimonios.detalle.push({ nombre: t.nombre, estado: "creado", ...(trabajo ? { trabajo: idTrabajo! } : {}) });
    } catch (err) {
      informe.testimonios.fallidos++;
      informe.testimonios.detalle.push({ nombre: t.nombre, estado: "fallido", error: mensaje(err) });
    }
  }

  // ── 6. Borrador del sitio: páginas, portada y menú ─────────────────────────────────────────────
  avisar("Armando las páginas, la portada y el menú del borrador…");
  const borrador = await destino.leerBorrador();
  const sections: WebsiteSections = parseWebsiteSections(borrador.sectionsJson);
  let cambioSecciones = false;
  const ctx: ContextoBloques = { prefijoSitio, copiar, ws };

  const sobre = paginas.find((p) => p.def.alboom === "/sobre")?.pagina ?? null;
  for (const { def, pagina } of paginas) {
    const fila = { slug: def.slug, alboom: def.alboom };
    try {
      if (findPageBySlug(sections, def.slug)) {
        informe.paginas.existentes++;
        informe.paginas.detalle.push({ ...fila, bloques: 0, estado: "existente" });
        continue;
      }
      const otros = Object.values(sections.pageMeta).map((m) => m.slug);
      const errorSlug = validatePageSlug(def.slug, otros);
      if (errorSlug) throw new Error(errorSlug);
      const clave = claveDePagina(def.slug, Object.keys(sections.pages));
      const bloques = await bloquesDePagina(def, pagina, clave, mapaEnlaces, ctx);
      sections.pages[clave] = bloques;
      sections.pageMeta[clave] = { slug: def.slug, title: (def.titulo ?? pagina.titulo).slice(0, 120) || def.slug };
      cambioSecciones = true;
      informe.paginas.creados++;
      informe.paginas.detalle.push({ ...fila, bloques: bloques.length, estado: "creado" });
    } catch (err) {
      informe.paginas.fallidos++;
      informe.paginas.detalle.push({ ...fila, bloques: 0, estado: "fallido", error: mensaje(err) });
    }
  }

  const home = sections.pages.home ?? [];
  if (home.some((b) => b.id.startsWith(`${ID_PORTADA}_`))) {
    informe.portada = { estado: "existente", bloquesAnteriores: home.length };
  } else {
    const fotosCarrusel = [...destacados]
      .map((id) => trabajoPorAlboom.get(id)?.portadaUrl)
      .filter((u): u is string => Boolean(u))
      .slice(0, FOTOS_DEL_CARRUSEL);
    sections.pages.home = portadaDnx({ prefijoSitio, fotosCarrusel, sobre, mapaEnlaces });
    informe.portada = { estado: "creada", bloquesAnteriores: home.length };
    if (home.length) informe.avisos.push(`La portada del borrador tenía ${home.length} bloques: se reemplazó por la importada (la versión publicada no cambia).`);
    cambioSecciones = true;
  }

  const menuActual = parseSiteMenu(borrador.navJson);
  let nuevoMenu: SiteMenu | undefined;
  if (menuActual?.items.some((i) => i.id === ID_MENU_TIENDA)) {
    informe.menu = "existente";
  } else {
    nuevoMenu = menuDnx(sections);
    informe.menu = "creado";
  }

  if (cambioSecciones || nuevoMenu) {
    const validas = websiteSectionsSchema.parse(sections);
    await destino.guardarBorrador({ ...(cambioSecciones ? { sectionsJson: validas } : {}), ...(nuevoMenu ? { navJson: nuevoMenu } : {}) });
  }

  // ── 7. Logo ────────────────────────────────────────────────────────────────────────────────────
  if (await destino.logoActual()) {
    informe.logo = "ya tenía";
  } else {
    const logo = await copiar(LOGO_ALBOOM_DNX, `${FOTOFFICE_R2_PREFIXES.workspaceLogo}/${ws}/`, "Logo", { ladoMaximo: LADO_MAXIMO_AVATAR_PX });
    if (logo) {
      await destino.guardarLogo(logo.url);
      informe.logo = "copiado";
    } else informe.logo = "fallido";
  }

  // ── 8. Redirecciones ───────────────────────────────────────────────────────────────────────────
  avisar(`Guardando ${reglas.length} redirecciones…`);
  informe.redirecciones = { total: reglas.length, creadas: await destino.crearRedirecciones(reglas, ORIGEN_IMPORTACION) };

  return informe;
}

// ── Redirecciones y enlaces ───────────────────────────────────────────────────────────────────

/** Una ruta del sitemap que es una landing (no un artículo, trabajo, galería ni página conocida). */
function esLanding(ruta: string): boolean {
  const r = normalizarRuta(ruta);
  if (/^\/(post|portfolio|gallery|proof)(\/|$)/.test(r)) return false;
  return !RUTAS_CONOCIDAS.map(normalizarRuta).includes(r);
}

function armarRedirecciones(args: {
  articulos: ArticuloAlboom[];
  slugsArticulo: Map<string, string>;
  items: ItemTrabajo[];
  paginas: readonly PaginaAImportar[];
  paginasLeidas: Set<string>;
}): ReglaRedireccion[] {
  const out = new Map<string, ReglaRedireccion>();
  const poner = (desde: string, hacia: string, codigo: 301 | 302 = 301) => {
    const clave = desde.endsWith("*") ? `${normalizarRuta(desde.slice(0, -1))}${desde.slice(0, -1).endsWith("/") ? "/" : ""}*` : normalizarRuta(desde);
    // Una regla que lleva a sí misma no sirve (`/agenda` → `/agenda`); una dirección completa nunca lo es.
    if (!out.has(clave) && !(hacia.startsWith("/") && clave === normalizarRuta(hacia))) out.set(clave, { desde: clave, hacia, codigo });
  };
  for (const r of REDIRECCIONES_FIJAS) poner(r.desde, r.hacia, r.codigo);
  for (const c of CATEGORIAS_TRABAJOS) for (const a of c.alboom) poner(`/portfolio/${a}`, `/trabajos/${c.slug}`);
  for (const a of args.articulos) {
    const hacia = `/blog/${args.slugsArticulo.get(a.alboomId)}`;
    poner(`/post/${a.alboomId}-*`, hacia);
    poner(`/post.php?id=${a.alboomId}`, hacia);
    // La dirección canónica de Alboom no lleva el número (`/post/ServicioQR`): también se cubre.
    if (a.slugAlboom) poner(`/post/${a.slugAlboom}`, hacia);
  }
  for (const it of args.items) {
    const hacia = `/trabajos/${it.categoria}/${it.slug}`;
    if (it.esGaleria) {
      poner(`/gallery/${it.alboomId}-*`, hacia);
    } else {
      poner(`/portfolio/${it.categoriaAlboom}/${it.alboomId}-*`, hacia);
      poner(`/album.php?id=${it.alboomId}`, hacia);
    }
  }
  for (const p of args.paginas) {
    if (args.paginasLeidas.has(p.slug)) poner(p.alboom, `/${p.slug}`);
  }
  return [...out.values()];
}

/** Enlaces del sitio viejo → rutas nuevas bajo `/w/<slug>` (andan también en el dominio propio). */
function armarMapaEnlaces(reglas: ReglaRedireccion[], items: ItemTrabajo[], prefijoSitio: string): MapaEnlaces {
  const mapa = new Map<string, string>();
  for (const r of reglas) {
    if (r.desde.endsWith("*") || !r.hacia.startsWith("/")) continue;
    mapa.set(r.desde, destinoBajoPrefijo(r.hacia, prefijoSitio));
  }
  // `reescribirEnlace` busca las galerías por número como `/album.php?id=`.
  for (const it of items) {
    const clave = `/album.php?id=${it.alboomId}`;
    if (it.esGaleria && !mapa.has(clave)) mapa.set(clave, `${prefijoSitio}/trabajos/${it.categoria}/${it.slug}`);
  }
  return mapa;
}

// ── Bloques ───────────────────────────────────────────────────────────────────────────────────

type ContextoBloques = {
  prefijoSitio: string;
  ws: string;
  copiar: (url: string, prefijo: string, donde: string, opciones?: { ladoMaximo?: number }) => Promise<CopiaHecha | null>;
};

/** Clave de una página nueva a partir de su slug (`quien-soy` → `quien_soy`), sin repetir. */
function claveDePagina(slug: string, usadas: string[]): string {
  const base = slug.replace(/-/g, "_").slice(0, 36) || "p";
  let clave = base;
  for (let n = 2; usadas.includes(clave); n++) clave = `${base}_${n}`;
  return clave;
}

function bloque(tipo: WebsiteBlockType, id: string, config: Record<string, unknown>): WebsiteBlock {
  const base = createEmptyBlock(tipo, 0);
  return websiteBlockSchema.parse({ ...base, id, config: { ...base.config, ...config } });
}

function ordenar(bloques: WebsiteBlock[]): WebsiteBlock[] {
  return sanitizeBlocksForSave(websitePageContentSchema.parse(bloques.map((b, i) => ({ ...b, order: i }))));
}

const WHATSAPP_DNX = "https://wa.me/5493413419869";

async function bloquesDePagina(def: PaginaAImportar, pagina: PaginaAlboom, clave: string, mapaEnlaces: MapaEnlaces, ctx: ContextoBloques): Promise<WebsiteBlock[]> {
  const prefijo = `alboom_${clave}`;
  const bloques = paginaABloques(pagina, { mapaEnlaces, prefijoId: prefijo });
  if (pagina.portadaUrl) bloques.unshift(bloque("IMAGE", `${prefijo}_portada`, { imageUrl: pagina.portadaUrl, alt: def.titulo ?? pagina.titulo, widthPreset: "full" }));
  for (const extra of def.agregar ?? []) {
    if (extra === "PRESUPUESTO") {
      bloques.push(bloque("CTA", `${prefijo}_presupuesto`, { title: "¿Hablamos?", buttonLabel: "Pedí tu presupuesto", buttonUrl: `${ctx.prefijoSitio}/presupuesto`, stylePreset: "solid" }));
    } else if (extra === "WHATSAPP") {
      bloques.push(bloque("CTA", `${prefijo}_whatsapp`, { buttonLabel: "Escribinos por WhatsApp", buttonUrl: WHATSAPP_DNX, stylePreset: "outline" }));
    } else if (extra === "TESTIMONIOS") {
      bloques.push(bloque("TESTIMONIALS", `${prefijo}_testimonios`, { title: "Lo que dicen quienes se capacitaron", count: 6, layout: "carousel", showCta: false }));
    }
  }
  return ordenar(await copiarFotosDeBloques(bloques, ctx, `Página ${def.slug}`));
}

const SRC_IMG = /(<img\b[^>]*\ssrc\s*=\s*)(["'])(.*?)\2/gi;

/** Copia a R2 las fotos de los bloques (imagen, galería, carrusel y las `<img>` del texto). */
async function copiarFotosDeBloques(bloques: WebsiteBlock[], ctx: ContextoBloques, donde: string): Promise<WebsiteBlock[]> {
  const prefijo = prefijoImagenesPagina(ctx.ws);
  const nueva = async (url: string | undefined) => {
    if (!url || !/^https?:\/\//i.test(url)) return url;
    const copia = await ctx.copiar(urlOriginal(url), prefijo, donde);
    return copia?.url ?? url;
  };
  const out: WebsiteBlock[] = [];
  for (const b of bloques) {
    if (b.type === "IMAGE") {
      out.push({ ...b, config: { ...b.config, imageUrl: await nueva(b.config.imageUrl) } });
    } else if (b.type === "GALLERY") {
      const photos = [];
      for (const p of b.config.photos) photos.push({ ...p, url: (await nueva(p.url)) ?? p.url });
      out.push({ ...b, config: { ...b.config, photos } });
    } else if (b.type === "RICH_TEXT") {
      let html = b.config.html;
      for (const m of [...html.matchAll(SRC_IMG)]) {
        const valor = m[3].replace(/&amp;/g, "&");
        const copia = await nueva(valor);
        if (copia && copia !== valor) html = html.replace(m[0], `${m[1]}${m[2]}${copia}${m[2]}`);
      }
      out.push({ ...b, config: { ...b.config, html } });
    } else out.push(b);
  }
  return out;
}

/** Los primeros párrafos de «Quién soy» para presentar al estudio en la portada. */
function presentacion(sobre: PaginaAlboom | null, mapaEnlaces: MapaEnlaces): string {
  if (!sobre) return "";
  const conTexto = paginaABloques(sobre, { mapaEnlaces, prefijoId: "tmp" }).find((b) => b.type === "RICH_TEXT");
  if (!conTexto || conTexto.type !== "RICH_TEXT") return "";
  const parrafos = conTexto.config.html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  return parrafos.filter((p) => p.replace(/<[^>]+>/g, "").trim()).slice(0, 2).join("\n");
}

/** La portada del spec: carrusel, trabajos recientes, presentación, testimonios, blog, presupuesto y contacto. */
function portadaDnx(args: { prefijoSitio: string; fotosCarrusel: string[]; sobre: PaginaAlboom | null; mapaEnlaces: MapaEnlaces }): WebsiteBlock[] {
  const id = (n: string) => `${ID_PORTADA}_${n}`;
  const bloques: WebsiteBlock[] = [];
  const fotos = args.fotosCarrusel.length ? args.fotosCarrusel : [undefined];
  bloques.push(
    bloque("HERO", id("carrusel"), {
      slides: fotos.map((imageUrl, i) => ({
        id: `${id("foto")}_${i}`,
        imageUrl,
        imageFocus: "center",
        ...(i === 0 ? { title: "DNX Fotografía", showButton: true, buttonLabel: "Pedí tu presupuesto", buttonUrl: `${args.prefijoSitio}/presupuesto` } : { showButton: false }),
        buttonStyle: "solid",
        align: "center",
        contentPosition: "center",
        overlay: imageUrl ? "soft" : "none",
      })),
      autoplay: true,
      intervalMs: 5000,
      transition: "fade",
      showArrows: true,
      showIndicators: true,
      pauseOnHover: true,
      loop: true,
      heightPreset: "large",
    }),
  );
  bloques.push(bloque("PORTFOLIO", id("trabajos"), { title: "Trabajos recientes", count: 6, layout: "grid", showViewAll: true }));
  const texto = presentacion(args.sobre, args.mapaEnlaces);
  if (texto) {
    bloques.push(
      bloque("RICH_TEXT", id("presentacion"), {
        title: "Quiénes somos",
        html: `${texto}\n<p><a href="${args.prefijoSitio}/quien-soy">Conocé más sobre nosotros</a></p>`,
        align: "left",
        width: "normal",
      }),
    );
  }
  bloques.push(bloque("TESTIMONIALS", id("testimonios"), { title: "Lo que dicen de nosotros", count: 6, layout: "carousel", showCta: true }));
  bloques.push(bloque("BLOG_LATEST", id("blog"), { title: "Del blog", count: 3, showExcerpt: true }));
  bloques.push(bloque("INQUIRY_FORM", id("presupuesto"), { title: "Pedí tu presupuesto" }));
  bloques.push(
    bloque("CONTACT", id("contacto"), {
      title: "Contacto",
      useWorkspaceData: false,
      email: CONTACTO_DNX.email,
      phone: CONTACTO_DNX.phone,
      whatsapp: CONTACTO_DNX.whatsapp,
      whatsappText: CONTACTO_DNX.whatsappText,
      address: CONTACTO_DNX.address,
      mapsUrl: CONTACTO_DNX.mapsUrl,
      socials: CONTACTO_DNX.socials.map((s) => ({ ...s })),
    }),
  );
  return ordenar(bloques);
}

/**
 * El menú del spec: Inicio, Trabajos, Blog, Quién soy, Pedí tu presupuesto, Imprimí tus fotos,
 * Agendá un turno, Capacitate, Testimonios y Tienda Online (afuera, en otra pestaña). Las demás
 * páginas automáticas (cursos, tienda de FOTOFFICE…) quedan guardadas pero ocultas: si no, el menú
 * editado las agregaría al final.
 */
function menuDnx(sections: WebsiteSections): SiteMenu {
  const clave = (slug: string) => findPageBySlug(sections, slug)?.key ?? null;
  const items: SiteMenuEntry[] = [];
  const pagina = (page: string, label: string | null) => items.push({ id: `page:${page}`, kind: "page", page, label, hidden: false });
  const propia = (slug: string, label: string) => {
    const pageKey = clave(slug);
    if (pageKey) items.push({ id: `custom:${pageKey}`, kind: "custom", pageKey, label, hidden: false });
  };
  pagina("home", "Inicio");
  pagina(TRABAJOS_PUBLIC_PAGE_KEY, "Trabajos");
  pagina(BLOG_PUBLIC_PAGE_KEY, "Blog");
  propia("quien-soy", "Quién soy");
  pagina("presupuesto", "Pedí tu presupuesto");
  propia("imprimi-tus-fotos", "Imprimí tus fotos");
  propia("agenda", "Agendá un turno");
  propia("capacitate", "Capacitate");
  pagina(TESTIMONIOS_PUBLIC_PAGE_KEY, "Testimonios");
  items.push({ id: ID_MENU_TIENDA, kind: "link", label: "Tienda Online", url: TIENDA_ONLINE_DNX, newTab: true, hidden: false });
  const presentes = new Set(items.flatMap((i) => (i.kind === "page" ? [i.page] : [])));
  for (const p of PUBLIC_MODULE_PAGES) {
    if (!presentes.has(p.moduleKey)) items.push({ id: `page:${p.moduleKey}`, kind: "page", page: p.moduleKey, label: null, hidden: true });
  }
  return { version: SITE_MENU_VERSION, items };
}
