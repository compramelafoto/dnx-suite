import type { ContentPostCreateInput } from "@repo/content";
import type { DatosTestimonio } from "@/lib/testimonios/dominio";
import type { ReglaRedireccion } from "@/lib/website/redirecciones-reglas";

/**
 * Dónde escribe el importador. Dos implementaciones:
 *
 * - `destino-prisma.ts`: la base de verdad, por los repositorios de cada módulo (blog, Trabajos,
 *   Testimonios, borrador del sitio, redirecciones). Sólo con `--aplicar`.
 * - `crearDestinoEnMemoria` (acá): la simulación y los tests. No toca ninguna base.
 *
 * Cada método que crea algo primero busca si ya existe (por slug o por id externo): así una
 * segunda corrida no duplica nada.
 */

export type ArticuloNuevo = { data: ContentPostCreateInput; createdAt: Date };

export type MediaBlogNueva = { url: string; r2Key: string; filename: string; mimeType: string; sizeBytes: number };

export type TrabajoNuevo = {
  titulo: string;
  slug: string;
  categoriaId: string | null;
  lugar: string | null;
  fecha: Date | null;
  descripcionHtml: string | null;
  destacado: boolean;
  origenExternoId: string;
};

export type FotoDeTrabajoNueva = {
  tipo: "FOTO" | "VIDEO_URL";
  url: string;
  r2Key: string | null;
  ancho: number | null;
  alto: number | null;
  origenUrl: string;
};

export type TrabajoExistente = { id: string; slug: string; categoriaId: string | null; portadaUrl: string | null; origenesFotos: string[] };

export type TestimonioNuevo = {
  datos: DatosTestimonio;
  trabajoId: string | null;
  autorFotoUrl: string | null;
  autorFotoKey: string | null;
  origenExternoId: string;
  /** El permiso que se deja asentado (el autor lo publicó en el sitio anterior). */
  consentimientoTexto: string;
  orden: number;
};

export type BorradorDelSitio = { sectionsJson: unknown; navJson: unknown };

export interface DestinoImportacion {
  /** Slug público del sitio (`dnx-estudio`): arma los enlaces internos `/w/<slug>/…`. */
  slugPublico(): Promise<string | null>;

  autorBlog(nombre: string, slug: string): Promise<{ id: number; creado: boolean }>;
  categoriaBlog(nombre: string, slug: string): Promise<{ id: number; creada: boolean }>;
  articuloPorSlug(slug: string): Promise<{ id: number } | null>;
  crearArticulo(a: ArticuloNuevo): Promise<{ id: number }>;
  /** Anota una imagen en la biblioteca del blog si su key todavía no está. Devuelve si la anotó. */
  registrarMediaBlog(m: MediaBlogNueva): Promise<boolean>;

  categoriaTrabajo(nombre: string, slug: string): Promise<{ id: string; creada: boolean }>;
  trabajoPorOrigen(origenExternoId: string): Promise<TrabajoExistente | null>;
  slugsDeTrabajos(): Promise<string[]>;
  crearTrabajo(t: TrabajoNuevo): Promise<{ id: string }>;
  agregarFotosTrabajo(trabajoId: string, fotos: FotoDeTrabajoNueva[]): Promise<number>;
  publicarTrabajo(trabajoId: string): Promise<void>;

  testimonioPorOrigen(origenExternoId: string): Promise<{ id: string } | null>;
  crearTestimonio(t: TestimonioNuevo): Promise<{ id: string }>;

  leerBorrador(): Promise<BorradorDelSitio>;
  guardarBorrador(cambios: { sectionsJson?: unknown; navJson?: unknown }): Promise<void>;
  logoActual(): Promise<string | null>;
  guardarLogo(url: string): Promise<void>;

  /** Crea las que falten (una `desde` que ya existe no se toca). Devuelve cuántas creó. */
  crearRedirecciones(reglas: ReglaRedireccion[], origen: string): Promise<number>;
}

/** Lo que guarda el destino en memoria; los tests lo miran directamente. */
export type EstadoEnMemoria = {
  slugPublico: string | null;
  autores: Array<{ id: number; nombre: string; slug: string }>;
  categoriasBlog: Array<{ id: number; nombre: string; slug: string }>;
  articulos: Array<{ id: number } & ArticuloNuevo>;
  mediaBlog: MediaBlogNueva[];
  categoriasTrabajos: Array<{ id: string; nombre: string; slug: string }>;
  trabajos: Array<{ id: string; estado: "BORRADOR" | "PUBLICADO"; portadaUrl: string | null; fotos: FotoDeTrabajoNueva[] } & TrabajoNuevo>;
  testimonios: Array<{ id: string } & TestimonioNuevo>;
  borrador: BorradorDelSitio;
  logoUrl: string | null;
  redirecciones: Array<ReglaRedireccion & { origen: string }>;
};

export function estadoVacio(slugPublico: string | null = null): EstadoEnMemoria {
  return {
    slugPublico,
    autores: [],
    categoriasBlog: [],
    articulos: [],
    mediaBlog: [],
    categoriasTrabajos: [],
    trabajos: [],
    testimonios: [],
    borrador: { sectionsJson: null, navJson: null },
    logoUrl: null,
    redirecciones: [],
  };
}

/** Destino que sólo vive en memoria: la simulación y los tests. */
export function crearDestinoEnMemoria(estado: EstadoEnMemoria = estadoVacio()): DestinoImportacion & { estado: EstadoEnMemoria } {
  let siguiente = 1;
  const nuevoId = () => siguiente++;
  return {
    estado,
    async slugPublico() {
      return estado.slugPublico;
    },
    async autorBlog(nombre, slug) {
      const hay = estado.autores.find((a) => a.slug === slug);
      if (hay) return { id: hay.id, creado: false };
      const id = nuevoId();
      estado.autores.push({ id, nombre, slug });
      return { id, creado: true };
    },
    async categoriaBlog(nombre, slug) {
      const hay = estado.categoriasBlog.find((c) => c.slug === slug);
      if (hay) return { id: hay.id, creada: false };
      const id = nuevoId();
      estado.categoriasBlog.push({ id, nombre, slug });
      return { id, creada: true };
    },
    async articuloPorSlug(slug) {
      const a = estado.articulos.find((x) => x.data.slug === slug);
      return a ? { id: a.id } : null;
    },
    async crearArticulo(a) {
      const id = nuevoId();
      estado.articulos.push({ id, ...a });
      return { id };
    },
    async registrarMediaBlog(m) {
      if (estado.mediaBlog.some((x) => x.r2Key === m.r2Key)) return false;
      estado.mediaBlog.push(m);
      return true;
    },
    async categoriaTrabajo(nombre, slug) {
      const hay = estado.categoriasTrabajos.find((c) => c.slug === slug);
      if (hay) return { id: hay.id, creada: false };
      const id = `cat${nuevoId()}`;
      estado.categoriasTrabajos.push({ id, nombre, slug });
      return { id, creada: true };
    },
    async trabajoPorOrigen(origenExternoId) {
      const t = estado.trabajos.find((x) => x.origenExternoId === origenExternoId);
      return t ? { id: t.id, slug: t.slug, categoriaId: t.categoriaId, portadaUrl: t.portadaUrl, origenesFotos: t.fotos.map((f) => f.origenUrl) } : null;
    },
    async slugsDeTrabajos() {
      return estado.trabajos.map((t) => t.slug);
    },
    async crearTrabajo(t) {
      if (estado.trabajos.some((x) => x.slug === t.slug)) throw new Error(`Ya hay otro trabajo con la dirección ${t.slug}`);
      const id = `trabajo${nuevoId()}`;
      estado.trabajos.push({ id, estado: "BORRADOR", portadaUrl: null, fotos: [], ...t });
      return { id };
    },
    async agregarFotosTrabajo(trabajoId, fotos) {
      const t = estado.trabajos.find((x) => x.id === trabajoId);
      if (!t) throw new Error("El trabajo no existe");
      const nuevas = fotos.filter((f) => !f.r2Key || !t.fotos.some((o) => o.r2Key === f.r2Key));
      t.fotos.push(...nuevas);
      if (!t.portadaUrl) t.portadaUrl = nuevas.find((f) => f.tipo === "FOTO")?.url ?? null;
      return nuevas.length;
    },
    async publicarTrabajo(trabajoId) {
      const t = estado.trabajos.find((x) => x.id === trabajoId);
      if (t) t.estado = "PUBLICADO";
    },
    async testimonioPorOrigen(origenExternoId) {
      const t = estado.testimonios.find((x) => x.origenExternoId === origenExternoId);
      return t ? { id: t.id } : null;
    },
    async crearTestimonio(t) {
      const id = `testimonio${nuevoId()}`;
      estado.testimonios.push({ id, ...t });
      return { id };
    },
    async leerBorrador() {
      return estado.borrador;
    },
    async guardarBorrador(cambios) {
      estado.borrador = {
        sectionsJson: cambios.sectionsJson !== undefined ? cambios.sectionsJson : estado.borrador.sectionsJson,
        navJson: cambios.navJson !== undefined ? cambios.navJson : estado.borrador.navJson,
      };
    },
    async logoActual() {
      return estado.logoUrl;
    },
    async guardarLogo(url) {
      estado.logoUrl = url;
    },
    async crearRedirecciones(reglas, origen) {
      let creadas = 0;
      for (const r of reglas) {
        if (estado.redirecciones.some((x) => x.desde === r.desde)) continue;
        estado.redirecciones.push({ ...r, origen });
        creadas++;
      }
      return creadas;
    },
  };
}
