import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

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
  /** Mismo valor que `WorkspaceFeatureModule.moduleKey`. */
  moduleKey: string;
  /** Segmento bajo `/w/[slug]/`. Es también su entrada en el menú. */
  segment: string;
  /** Etiqueta visible. Ojo: el vocabulario por workspace todavía no se aplica acá. */
  label: string;
  order: number;
};

export const PUBLIC_MODULE_PAGES: readonly PublicModulePage[] = [
  { moduleKey: COURSES_SALES_MODULE_KEY, segment: "cursos", label: "Cursos", order: 10 },
  { moduleKey: BOOKINGS_MODULE_KEY, segment: "reservas", label: "Reservas", order: 20 },
  { moduleKey: MEMBERS_MODULE_KEY, segment: "asociarse", label: "Asociarse", order: 30 },
] as const;

/** Las páginas de los módulos habilitados, en su orden de presentación. */
export function publicModulePagesFor(enabledModuleKeys: ReadonlySet<string>): PublicModulePage[] {
  return PUBLIC_MODULE_PAGES.filter((p) => enabledModuleKeys.has(p.moduleKey))
    .slice()
    .sort((a, b) => a.order - b.order);
}

/**
 * Segmentos que una página del dueño no puede ocupar, porque ya los usa el sitio. Los de
 * módulos se derivan de `PUBLIC_MODULE_PAGES`; los fijos son rutas propias del sitio que no
 * pertenecen a ningún módulo.
 *
 * No se usa todavía: lo consume la validación al crear una página, en la etapa 2. Se define
 * acá, junto a su fuente, para que nazca derivado y no escrito a mano.
 */
const SEGMENTOS_FIJOS = ["xv", "sitemap.xml", "robots.txt"] as const;

export const SITE_RESERVED_SEGMENTS: readonly string[] = [
  ...new Set([...PUBLIC_MODULE_PAGES.map((p) => p.segment), ...SEGMENTOS_FIJOS]),
];

export function isSiteSegmentReserved(segment: string): boolean {
  return SITE_RESERVED_SEGMENTS.includes(segment.trim().toLowerCase());
}
