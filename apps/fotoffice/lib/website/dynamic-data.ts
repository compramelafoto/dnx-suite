import type { PortfolioBlock, WebsiteBlock } from "./blocks";
import type { TrabajoTarjeta } from "@/lib/trabajos/publico";
import type { TestimonioPublico } from "@/lib/testimonios/publico";
import type { SpotlightCardView } from "@/lib/spotlight/view";
import type { HeroBlogSlide } from "./blog-banner";
import type { PublicSiteContact } from "./public-site";
import type { PaginasDelSitio } from "./button-href";

/**
 * Datos que los bloques `dynamic` necesitan y que NO viven en `sectionsJson`: se leen en el
 * servidor al dibujar la página pública y bajan al renderer como una prop más.
 *
 * Es un objeto plano y serializable a propósito: el mismo `WebsitePageRenderer` se usa en la
 * vista previa del builder, que es un componente de cliente sin acceso a la base. Ahí no llega
 * nada (`undefined`) y cada bloque dinámico muestra un ejemplo en su lugar — así el dueño ve
 * cómo va a quedar sin que el builder tenga que consultar otro módulo.
 *
 * Privacidad: lo que entra acá termina en el HTML de cualquiera. Sólo campos ya públicos, con
 * forma propia (nunca el modelo de Prisma entero).
 */
export type BlogCardItem = {
  id: number;
  href: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  /** Ya formateada en hora argentina en el servidor: el navegador no tiene que adivinar la zona. */
  dateLabel: string | null;
  dateIso: string | null;
};

export type BlogLatestData = {
  blogHref: string;
  posts: BlogCardItem[];
};

/** El socio de esta semana, ya filtrado por permiso de publicación (ver `buildSpotlightCard`). */
export type MemberOfWeekData = {
  card: SpotlightCardView | null;
  weekLabel: string;
};

/** Artículos destacados desde el blog, para el banner principal (`blockId`). Ver `blog-banner.ts`. */
export type HeroBlogData = {
  blockId: string;
  slides: HeroBlogSlide[];
};

export type WebsiteDynamicData = {
  /**
   * Datos de MUESTRA (la vista previa de las plantillas): los bloques que no tienen su parte acá
   * se dibujan como en el constructor, con ejemplos y sin poder enviar nada (el formulario de
   * presupuesto queda deshabilitado). Nunca lo pone el sitio público.
   */
  muestra?: boolean;
  /** Las páginas propias por dirección, para los botones que dicen `/quien-soy` (ver
   * `enlaceDeBoton`). Lo usan el Hero y el llamado a la acción. */
  paginasDelSitio?: PaginasDelSitio;
  blogLatest?: BlogLatestData;
  memberOfWeek?: MemberOfWeekData;
  heroBlog?: HeroBlogData;
  /** Contacto de la institución (el mismo del pie del sitio), para completar los campos vacíos
   * del bloque CONTACT. Ya es público; sólo viaja si la página tiene el bloque. */
  contact?: PublicSiteContact;
  /** Categorías y orígenes activos para el formulario de presupuesto (INQUIRY_FORM). Sólo viaja
   * si la página tiene el bloque y Consultas está encendido; sin esto el bloque no se dibuja. */
  inquiry?: InquiryFormData;
  /** Las tarjetas de cada bloque PORTFOLIO, por id de bloque: dos bloques pueden pedir
   * categorías o cantidades distintas. Un bloque sin entrada (o sin tarjetas) no se dibuja. */
  portfolio?: Record<string, PortfolioData>;
  /** Los testimonios PUBLICADOS (sin el correo del autor), una sola lectura para todos los bloques
   * TESTIMONIALS de la página: cada uno corta los primeros N. Sin ninguno, el bloque no se dibuja. */
  testimonios?: TestimoniosData;
};

export type TestimoniosData = {
  items: TestimonioPublico[];
  /** `/w/<slug>/testimonios`. */
  verTodosHref: string;
  /** `/w/<slug>/testimonio`: el formulario abierto para dejar uno. */
  formularioHref: string;
};

/** Lo que dibuja un bloque PORTFOLIO: sólo trabajos PUBLICADOS de categorías visibles. */
export type PortfolioData = {
  tarjetas: TrabajoTarjeta[];
  /** `/w/<slug>/trabajos`, o la página de la categoría si el bloque pide una. */
  verTodosHref: string;
};

export type InquiryFormData = {
  /** A qué workspace va la consulta (el formulario lo manda a `createSiteInquiry`). */
  workspaceSlug: string;
  categorias: Array<{ id: string; nombre: string }>;
  origenes: Array<{ id: string; nombre: string }>;
  /** Categoría preelegida (`/presupuesto?categoria=<id>`); se ignora si no está en la lista. */
  categoriaPreelegida?: string;
};

export function hasVisibleInquiryForm(blocks: readonly WebsiteBlock[]): boolean {
  return blocks.some((b) => b.type === "INQUIRY_FORM" && b.visible);
}

export function hasVisibleContact(blocks: readonly WebsiteBlock[]): boolean {
  return blocks.some((b) => b.type === "CONTACT" && b.visible);
}

export function hasVisibleMemberOfWeek(blocks: readonly WebsiteBlock[]): boolean {
  return blocks.some((b) => b.type === "MEMBER_OF_WEEK" && b.visible);
}

/**
 * Cuántos artículos hay que leer para los bloques "Últimos artículos" de la página: el mayor
 * `count` entre los visibles, o 0 si no hay ninguno — en ese caso no se consulta el blog.
 * Una sola consulta alcanza para todos: cada bloque recorta los primeros N.
 */
export function blogLatestLimitFor(blocks: readonly WebsiteBlock[]): number {
  let limit = 0;
  for (const block of blocks) {
    if (block.type === "BLOG_LATEST" && block.visible) limit = Math.max(limit, block.config.count);
  }
  return limit;
}

/**
 * Cuántos testimonios leer para los bloques TESTIMONIALS visibles: 0 si no hay ninguno (no se
 * consulta), el mayor `count`, o `null` (todos) si alguno pide todos (`count: 0`).
 */
export function testimonialsLimitFor(blocks: readonly WebsiteBlock[]): number | null {
  let limit = 0;
  for (const block of blocks) {
    if (block.type !== "TESTIMONIALS" || !block.visible) continue;
    if (block.config.count === 0) return null;
    limit = Math.max(limit, block.config.count);
  }
  return limit;
}

/** Los bloques "Trabajos" visibles de la página. Sin ninguno, Trabajos ni se consulta. */
export function portfolioBlocksFor(blocks: readonly WebsiteBlock[]): PortfolioBlock[] {
  return blocks.filter((b): b is PortfolioBlock => b.type === "PORTFOLIO" && b.visible);
}

/** Dirección de cada página propia bajo `base` (`/w/<slug>` en el sitio público). */
export function paginasDelSitio(base: string, pageMeta: Readonly<Record<string, { slug: string }>>): Record<string, string> {
  const paginas: Record<string, string> = {};
  for (const meta of Object.values(pageMeta)) paginas[meta.slug] = `${base}/${meta.slug}`;
  return paginas;
}

const TRABAJOS_DE_MUESTRA = [
  { titulo: "XV de Martina", categoria: "XV años", lugar: "Rosario" },
  { titulo: "Casamiento de Lucía y Tomás", categoria: "Casamientos", lugar: "Funes" },
  { titulo: "Book en el estudio", categoria: "Retratos", lugar: "Estudio" },
  { titulo: "Retratos en la ciudad", categoria: "Retratos", lugar: "Centro" },
  { titulo: "XV de Valentina", categoria: "XV años", lugar: "Roldán" },
  { titulo: "Casamiento de Sofía y Martín", categoria: "Casamientos", lugar: "Rosario" },
] as const;

const TESTIMONIOS_DE_MUESTRA = [
  { autor: "Carolina (mamá de Martina)", detalle: "XV de Martina", texto: "Ejemplo de testimonio: así se ve lo que cuenta una familia después de la fiesta. Acá van a aparecer los testimonios que publiques." },
  { autor: "Lucía y Tomás", detalle: "Casamiento", texto: "Ejemplo de testimonio: una pareja contando cómo fue trabajar con vos el día del casamiento." },
  { autor: "Julieta", detalle: "Book en el estudio", texto: "Ejemplo de testimonio corto, con su calificación." },
] as const;

/**
 * Datos de MUESTRA para la vista previa de una plantilla: 6 trabajos y 3 testimonios ficticios
 * con las fotos de muestra de la plantilla (nunca datos de un cliente real), una entrada de
 * trabajos por cada bloque PORTFOLIO, y las páginas de la plantilla para los botones. Puro.
 */
export function datosDeMuestra(input: { bloques: readonly WebsiteBlock[]; fotos: readonly string[]; paginas: PaginasDelSitio }): WebsiteDynamicData {
  const foto = (i: number) => (input.fotos.length > 0 ? input.fotos[i % input.fotos.length]! : null);
  const tarjetas: TrabajoTarjeta[] = TRABAJOS_DE_MUESTRA.map((t, i) => ({
    titulo: t.titulo,
    slug: `muestra-${i + 1}`,
    categoriaSlug: "muestra",
    categoriaNombre: t.categoria,
    lugar: t.lugar,
    fechaTexto: null,
    portadaUrl: foto(i),
    href: "#",
  }));
  const portfolio: Record<string, PortfolioData> = {};
  for (const bloque of portfolioBlocksFor(input.bloques)) portfolio[bloque.id] = { tarjetas, verTodosHref: "#" };
  return {
    muestra: true,
    paginasDelSitio: input.paginas,
    portfolio,
    testimonios: {
      items: TESTIMONIOS_DE_MUESTRA.map((t, i) => ({
        id: `muestra-${i + 1}`,
        texto: t.texto,
        extracto: null,
        autorNombre: t.autor,
        autorDetalle: t.detalle,
        autorFotoUrl: null,
        autorEnlace: null,
        calificacion: 5,
      })),
      verTodosHref: "#",
      formularioHref: "#",
    },
  };
}
