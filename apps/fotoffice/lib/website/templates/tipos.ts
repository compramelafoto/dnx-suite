import type { HeroBlockConfig, HeroSlide, WebsiteBlock, WebsiteBlockType, WebsitePageMeta } from "../blocks";
import { DEFAULT_DESIGN_PRESETS, type WebsiteDesignPresets } from "../design-presets";
import type { WebsiteColors } from "../branding-defaults";
import { SITE_MENU_VERSION, type SiteMenu, type SiteMenuEntry } from "../site-menu";
import type { FotofficeOrganizationTypeId } from "../../onboarding-constants";

/**
 * Una plantilla es un sitio completo de muestra: diseño + páginas con bloques (textos y fotos
 * de muestra) + menú. NUNCA es dueña del contenido: quien la aplica es `aplicarPlantilla`
 * (`apply-template.ts`), que sólo agrega lo que falta y no pisa ni borra nada del usuario.
 *
 * Los textos de muestra van marcados para reemplazar («Contá acá…»): son un ejemplo, no un texto
 * que el dueño deba publicar tal cual.
 */
export const SITE_TEMPLATE_IDS = ["eventos", "estudio", "retrato-editorial", "oscura", "institucion"] as const;
export type SiteTemplateId = (typeof SITE_TEMPLATE_IDS)[number];

export type LayoutPreviewBand = "hero" | "text" | "image" | "cta";

export type SiteTemplatePage = {
  /** `home` para la portada; las demás, la clave de `sectionsJson.pages` que se usa si está libre. */
  clave: string;
  /** Título y dirección. La portada no tiene. */
  meta?: WebsitePageMeta;
  bloques: WebsiteBlock[];
};

export type SiteTemplate = {
  id: SiteTemplateId;
  nombre: string;
  descripcion: string;
  /** Para quién está pensada, en una frase (lo muestra el selector). */
  paraQuien: string;
  /** Recomendación, nunca restricción: decide qué se muestra destacado. */
  recommendedFor: FotofficeOrganizationTypeId[];
  /** Reservado para una futura distinción gratis/premium. */
  tier: "free";
  /** Miniatura abstracta del selector actual (la reemplaza la vista previa real). */
  layoutPreview: LayoutPreviewBand[];
  design: WebsiteDesignPresets;
  /** Colores de marca sugeridos. Sólo se aplican si el usuario lo confirma (no pisan su marca). */
  coloresSugeridos: WebsiteColors | null;
  /** La primera es siempre la portada (`home`). */
  paginas: SiteTemplatePage[];
  /** El menú con el que arranca un sitio vacío. Los ítems `custom` apuntan a `paginas[].clave`. */
  menu: SiteMenu;
};

// ---------------------------------------------------------------------------------------------
// Ayudas para escribir las plantillas como datos: ids fijos (legibles y estables entre
// ejecuciones, así los tests comparan igual) y `order` puesto según la posición.

type ConfigDe<T extends WebsiteBlockType> = Extract<WebsiteBlock, { type: T }>["config"];

export function bloque<T extends WebsiteBlockType>(id: string, type: T, config: ConfigDe<T>): WebsiteBlock {
  return { id, type, visible: true, order: 0, config } as WebsiteBlock;
}

/** Pone `order` 0, 1, 2… según la posición en la lista. */
export function enOrden(bloques: WebsiteBlock[]): WebsiteBlock[] {
  return bloques.map((b, i) => ({ ...b, order: i }) as WebsiteBlock);
}

/** Una placa del Hero con todos los campos con `.catch` explícitos: así el parseo no cambia nada. */
export function placa(id: string, datos: Partial<HeroSlide>): HeroSlide {
  return {
    id,
    imageFocus: "center",
    showButton: false,
    buttonStyle: "solid",
    align: "center",
    contentPosition: "center",
    overlay: "none",
    ...datos,
  };
}

export function hero(id: string, slides: HeroSlide[], opciones: Partial<Omit<HeroBlockConfig, "slides">> = {}): WebsiteBlock {
  return bloque(id, "HERO", {
    slides,
    autoplay: true,
    intervalMs: 5000,
    transition: "fade",
    showArrows: slides.length > 1,
    showIndicators: slides.length > 1,
    pauseOnHover: true,
    loop: true,
    heightPreset: "large",
    ...opciones,
  });
}

/** El diseño de siempre con lo que cambia la plantilla. */
export function diseno(cambios: Partial<WebsiteDesignPresets>): WebsiteDesignPresets {
  return { ...DEFAULT_DESIGN_PRESETS, ...cambios };
}

/** Menú: Inicio y después las páginas de la plantilla, en orden. */
export function menuDe(clavesPropias: string[]): SiteMenu {
  const items: SiteMenuEntry[] = [
    { id: "page:home", kind: "page", page: "home", label: null, hidden: false },
    ...clavesPropias.map((pageKey): SiteMenuEntry => ({ id: `custom:${pageKey}`, kind: "custom", pageKey, label: null, hidden: false })),
  ];
  return { version: SITE_MENU_VERSION, items };
}
