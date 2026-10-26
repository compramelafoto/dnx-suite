import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import {
  BLOG_PUBLIC_PAGE_KEY,
  INSTITUTIONAL_PUBLIC_SEGMENT,
  PRESUPUESTO_PAGE_LABEL,
  TESTIMONIOS_PUBLIC_PAGE_KEY,
  TESTIMONIOS_PUBLIC_SEGMENT,
  TRABAJOS_PUBLIC_PAGE_KEY,
  TRABAJOS_PUBLIC_SEGMENT,
} from "./constants";
import { PORTFOLIO_MODULE_KEY, PORTFOLIO_PUBLIC_SEGMENT } from "@/lib/portfolio/constants";
import { STORE_MODULE_KEY, STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";

/**
 * Las páginas públicas que aporta cada módulo al sitio: qué segmento ocupan bajo
 * `/w/[slug]/`, cómo se llaman en el menú y en qué orden van.
 *
 * Es la ÚNICA fuente de verdad de esa correspondencia. La consumen el menú público, el
 * armazón y la lista de segmentos reservados — si viviera en tres lados, agregar un módulo
 * nuevo obligaría a acordarse de los tres.
 *
 * Agregar un módulo con página pública es agregar una entrada acá y crear su carpeta en
 * `app/w/[workspaceSlug]/<segment>/`.
 */
export type PublicModulePage = {
  /** Mismo valor que `WorkspaceFeatureModule.moduleKey` — salvo el blog, Trabajos y Testimonios, que
   * no son módulos y usan una llave propia (`BLOG_PUBLIC_PAGE_KEY`, `TRABAJOS_PUBLIC_PAGE_KEY`,
   * `TESTIMONIOS_PUBLIC_PAGE_KEY`). */
  moduleKey: string;
  /** Segmento bajo `/w/[slug]/`. Es también su entrada en el menú. */
  segment: string;
  /** Etiqueta visible por omisión. La usa toda página que no declare `labelFromVocabulary`. */
  label: string;
  /**
   * Cuando está, la etiqueta sale del vocabulario del workspace en lugar de `label`. Una
   * institución de voluntarios no puede tener un menú que diga "Socios".
   *
   * **El segmento nunca sigue al vocabulario, sólo la etiqueta.** Si la dirección cambiara al
   * cambiar la palabra en Configuración, se romperían todos los enlaces ya publicados: la palabra
   * es de cara al visitante, la dirección es un compromiso.
   */
  labelFromVocabulary?: "personPlural";
  order: number;
};

export const PUBLIC_MODULE_PAGES: readonly PublicModulePage[] = [
  { moduleKey: COURSES_SALES_MODULE_KEY, segment: "cursos", label: "Cursos", order: 10 },
  { moduleKey: BOOKINGS_MODULE_KEY, segment: "reservas", label: "Reservas", order: 20 },
  {
    moduleKey: PORTFOLIO_MODULE_KEY,
    segment: PORTFOLIO_PUBLIC_SEGMENT,
    label: "Socios",
    labelFromVocabulary: "personPlural",
    order: 25,
  },
  { moduleKey: MEMBERS_MODULE_KEY, segment: "asociarse", label: "Asociarse", order: 30 },
  // Entra al menú sólo con la tienda ABIERTA, no alcanza con el módulo encendido: ver
  // `withStoreOpenState`, que aplica `loadPublicSite`.
  { moduleKey: STORE_MODULE_KEY, segment: STORE_PUBLIC_SEGMENT, label: "Tienda", order: 35 },
  // Entra al menú sólo con al menos un trabajo publicado: ver `withTrabajosPage`.
  { moduleKey: TRABAJOS_PUBLIC_PAGE_KEY, segment: TRABAJOS_PUBLIC_SEGMENT, label: "Trabajos", order: 38 },
  // Entra al menú sólo con al menos un testimonio publicado: ver `withTestimoniosPage`.
  { moduleKey: TESTIMONIOS_PUBLIC_PAGE_KEY, segment: TESTIMONIOS_PUBLIC_SEGMENT, label: "Testimonios", order: 39 },
  { moduleKey: BLOG_PUBLIC_PAGE_KEY, segment: "blog", label: "Blog", order: 40 },
] as const;

/**
 * La etiqueta que ve el visitante, ya resuelta contra el vocabulario de la institución.
 *
 * Las páginas que no declaran `labelFromVocabulary` devuelven su etiqueta fija, así agregar esto
 * no cambió ninguna de las que ya existían.
 */
export function resolvePublicModuleLabel(
  page: PublicModulePage,
  vocabulary: PersonVocabulary,
): string {
  if (page.labelFromVocabulary === "personPlural") return vocabulary.Plural;
  return page.label;
}

/** Las páginas de los módulos habilitados, en su orden de presentación. */
export function publicModulePagesFor(enabledModuleKeys: ReadonlySet<string>): PublicModulePage[] {
  return PUBLIC_MODULE_PAGES.filter((p) => enabledModuleKeys.has(p.moduleKey))
    .slice()
    .sort((a, b) => a.order - b.order);
}

/**
 * La tienda es el único módulo cuya página pública no alcanza con tenerlo encendido: el dueño
 * la abre y la cierra desde su configuración (`StoreSettings.isOpen`), y una tienda cerrada no
 * puede quedar en el menú llevando a una vidriera vacía. Saca la clave de la tienda de los
 * módulos habilitados cuando está cerrada; el resto queda intacto.
 */
export function withStoreOpenState(enabledModuleKeys: ReadonlySet<string>, storeOpen: boolean): Set<string> {
  const claves = new Set(enabledModuleKeys);
  // La tienda vende el catálogo de Ventas: sin Ventas encendido no hay tienda (igual que `loadOpenStore`).
  if (!storeOpen || !enabledModuleKeys.has(SALES_MODULE_KEY)) claves.delete(STORE_MODULE_KEY);
  return claves;
}

/**
 * Trabajos va al menú como el blog: sólo con al menos un trabajo publicado (un portfolio vacío
 * sería un ítem que lleva a «todavía no hay trabajos»). Suma su llave propia a los módulos
 * habilitados cuando corresponde; nunca modifica el conjunto que recibe.
 */
export function withTrabajosPage(enabledModuleKeys: ReadonlySet<string>, hasPublishedTrabajos: boolean): Set<string> {
  const claves = new Set(enabledModuleKeys);
  if (hasPublishedTrabajos) claves.add(TRABAJOS_PUBLIC_PAGE_KEY);
  return claves;
}

/** Testimonios, igual que Trabajos: al menú sólo con al menos un testimonio publicado. */
export function withTestimoniosPage(enabledModuleKeys: ReadonlySet<string>, hasPublishedTestimonios: boolean): Set<string> {
  const claves = new Set(enabledModuleKeys);
  if (hasPublishedTestimonios) claves.add(TESTIMONIOS_PUBLIC_PAGE_KEY);
  return claves;
}

/**
 * Páginas públicas que existen pero que NO entran solas al menú: el dueño las suma a mano desde
 * la pestaña Menú del constructor. Están separadas de `PUBLIC_MODULE_PAGES` a propósito — si
 * vivieran ahí, aparecerían de golpe en el menú de todos los sitios ya publicados.
 *
 * `moduleKey: null` es una página del sitio que no depende de ningún módulo.
 */
export type OptionalPublicPage = {
  /** Identificador estable que se guarda en el menú (`navJson`). No cambiarlo nunca. */
  key: string;
  moduleKey: string | null;
  /** Ruta bajo `/w/[slug]/`. */
  path: string;
  label: string;
};

export const OPTIONAL_PUBLIC_PAGES: readonly OptionalPublicPage[] = [
  { key: "raffles", moduleKey: RAFFLES_MODULE_KEY, path: "sorteos", label: "Sorteos" },
  { key: "coverages", moduleKey: COVERAGES_MODULE_KEY, path: "coberturas/solicitar", label: "Pedir cobertura" },
  { key: "entrar", moduleKey: null, path: "entrar", label: "Ingresar" },
  // La comisión directiva que se carga en Configuración → Comisión, a la vista de todos.
  { key: "institucional", moduleKey: null, path: INSTITUTIONAL_PUBLIC_SEGMENT, label: "Institucional" },
  // El formulario de presupuesto a página completa: la consulta entra a Consultas. Es opcional
  // para que no aparezca de golpe en el menú de los sitios ya publicados; la ruta igual existe
  // con el módulo encendido (404 si está apagado). Convive con `presupuesto/[token]` (el enlace
  // del presupuesto que se le manda a cada cliente).
  { key: "presupuesto", moduleKey: SERVICE_LEADS_MODULE_KEY, path: "presupuesto", label: PRESUPUESTO_PAGE_LABEL },
] as const;

/** Las páginas opcionales disponibles con los módulos habilitados. */
export function optionalPublicPagesFor(enabledModuleKeys: ReadonlySet<string>): OptionalPublicPage[] {
  return OPTIONAL_PUBLIC_PAGES.filter((p) => p.moduleKey === null || enabledModuleKeys.has(p.moduleKey));
}

/**
 * Segmentos que una página del dueño no puede ocupar, porque ya los usa el sitio. Los de
 * módulos se derivan de `PUBLIC_MODULE_PAGES`; los fijos son rutas propias del sitio que no
 * pertenecen a ningún módulo.
 *
 * Lo consume `RESERVED_SITE_SEGMENTS` (`reserved-slugs.ts`), la lista única que valida la
 * dirección de una página propia. Se define acá, junto a su fuente, para que nazca derivado.
 */
const SEGMENTOS_FIJOS = ["xv", "sitemap.xml", "robots.txt"] as const;

export const SITE_RESERVED_SEGMENTS: readonly string[] = [
  ...new Set([
    ...PUBLIC_MODULE_PAGES.map((p) => p.segment),
    ...OPTIONAL_PUBLIC_PAGES.map((p) => p.path.split("/")[0]),
    ...SEGMENTOS_FIJOS,
  ]),
];

export function isSiteSegmentReserved(segment: string): boolean {
  return SITE_RESERVED_SEGMENTS.includes(segment.trim().toLowerCase());
}
