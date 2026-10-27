import { z } from "zod";
import { isAllowedMapsUrl } from "./contact";
import { externalHttpUrl, externalHttpsUrl } from "./blocks-extra";

/**
 * Contrato de bloques estáticos de la Home del sitio web — primera etapa del editor visual.
 * Se persiste dentro de `sectionsJson` (ver `WebsiteSections` abajo). `type` ahora es una unión
 * cerrada de los 5 bloques implementados en esta etapa: cerrarla era trabajo pendiente desde la
 * etapa de arquitectura, y corresponde hacerlo ahora que se implementan de verdad. Bloques
 * dinámicos futuros (Cursos, Socios, Beneficios, Eventos, Noticias) se agregan como variantes
 * nuevas de esta unión cuando se construyan — nunca reutilizan estos 5 tipos.
 */
export const WEBSITE_BLOCK_ALIGN = ["left", "center"] as const;
export type WebsiteBlockAlign = (typeof WEBSITE_BLOCK_ALIGN)[number];

export const WEBSITE_IMAGE_WIDTH_PRESET = ["full", "contained", "narrow"] as const;
export type WebsiteImageWidthPreset = (typeof WEBSITE_IMAGE_WIDTH_PRESET)[number];

export const WEBSITE_CTA_STYLE_PRESET = ["solid", "outline"] as const;
export type WebsiteCtaStylePreset = (typeof WEBSITE_CTA_STYLE_PRESET)[number];

export const WEBSITE_SPACER_SIZE_PRESET = ["sm", "md", "lg"] as const;
export type WebsiteSpacerSizePreset = (typeof WEBSITE_SPACER_SIZE_PRESET)[number];

/** Id local (bloques y placas) — mismo criterio que `createEmptyBlock`: `crypto.randomUUID`
 * cuando existe, con fallback determinístico-suficiente para entornos sin Web Crypto. */
function generateLocalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Hero / Banner — placas del carrusel (Parte "Banner multiplaca"). Cada placa es una unidad
 * completa (imagen + texto + botón + presentación) independiente de las demás; 1 placa = Hero
 * estático de siempre, 2+ = carrusel. Nada de esto es `.min(1)` en los campos de texto por el
 * mismo motivo que el resto de bloques: un placa recién agregada, vacía, debe poder autoguardarse.
 */
export const HERO_SLIDE_ALIGN = ["left", "center", "right"] as const;
export type HeroSlideAlign = (typeof HERO_SLIDE_ALIGN)[number];

export const HERO_CONTENT_POSITION = ["top", "center", "bottom"] as const;
export type HeroContentPosition = (typeof HERO_CONTENT_POSITION)[number];

export const HERO_IMAGE_FOCUS = ["center", "top", "bottom", "left", "right"] as const;
export type HeroImageFocus = (typeof HERO_IMAGE_FOCUS)[number];

/** Presets simples de legibilidad — nunca opacity arbitraria (ver pedido: "no permitir controles
 * técnicos de opacity si podemos evitarlo"). `medium` reproduce exactamente el overlay fijo que
 * tenía el Hero de una sola placa antes de esta etapa (rgba(15,23,42,0.45)) — así una placa
 * migrada de un Hero viejo con imagen se ve pixel-a-pixel igual. */
export const HERO_OVERLAY_PRESET = ["none", "soft", "medium", "dark"] as const;
export type HeroOverlayPreset = (typeof HERO_OVERLAY_PRESET)[number];

export const HERO_TRANSITION = ["fade", "slide"] as const;
export type HeroTransition = (typeof HERO_TRANSITION)[number];

export const HERO_HEIGHT_PRESET = ["compact", "normal", "large", "screen"] as const;
export type HeroHeightPreset = (typeof HERO_HEIGHT_PRESET)[number];

export const HERO_INTERVAL_MS_OPTIONS = [3000, 5000, 7000, 10000] as const;
export type HeroIntervalMs = (typeof HERO_INTERVAL_MS_OPTIONS)[number];
const heroIntervalMsSchema = z.union([z.literal(3000), z.literal(5000), z.literal(7000), z.literal(10000)]);

export const HERO_MIN_SLIDES = 1;
export const HERO_MAX_SLIDES = 10;

export const heroSlideSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().max(2000).optional(),
  imageAlt: z.string().max(300).optional(),
  imageFocus: z.enum(HERO_IMAGE_FOCUS).catch("center"),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(400).optional(),
  showButton: z.boolean().catch(false),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  buttonStyle: z.enum(WEBSITE_CTA_STYLE_PRESET).catch("solid"),
  align: z.enum(HERO_SLIDE_ALIGN).catch("center"),
  contentPosition: z.enum(HERO_CONTENT_POSITION).catch("center"),
  overlay: z.enum(HERO_OVERLAY_PRESET).catch("none"),
});
export type HeroSlide = z.infer<typeof heroSlideSchema>;

export function createEmptyHeroSlide(): HeroSlide {
  return {
    id: generateLocalId(),
    imageFocus: "center",
    showButton: false,
    buttonStyle: "solid",
    align: "center",
    contentPosition: "center",
    overlay: "none",
  };
}

/** Shape plano del Hero de una sola placa, tal como se guardó hasta la etapa anterior — sigue
 * viviendo acá SOLO para migrar `sectionsJson`/`WebsiteVersion` histórico, nunca se escribe de
 * nuevo. */
const legacyHeroConfigSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(400).optional(),
  imageUrl: z.string().max(2000).optional(),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  align: z.enum(WEBSITE_BLOCK_ALIGN),
});

/**
 * Migra un Hero guardado en el shape plano anterior (sin `slides`) a una única placa del
 * carrusel — preserva exactamente título/subtítulo/imagen/botón/alineación, cero pérdida de
 * contenido. Corre en el `preprocess` del schema, así que nunca se persiste sola: el draft se
 * normaliza recién si el usuario vuelve a guardar. Un objeto que YA tiene `slides` (Hero nuevo)
 * pasa sin tocar.
 */
function normalizeHeroConfig(raw: unknown): unknown {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw) && !("slides" in raw)) {
    const legacy = legacyHeroConfigSchema.safeParse(raw);
    if (legacy.success) {
      const { title, subtitle, imageUrl, buttonLabel, buttonUrl, align } = legacy.data;
      return {
        slides: [
          {
            id: "legacy",
            imageUrl,
            imageFocus: "center",
            title,
            subtitle,
            showButton: Boolean(buttonLabel && buttonUrl),
            buttonLabel,
            buttonUrl,
            buttonStyle: "solid",
            align,
            contentPosition: "center",
            overlay: imageUrl ? "medium" : "none",
          },
        ],
        autoplay: true,
        intervalMs: 5000,
        transition: "fade",
        showArrows: true,
        showIndicators: true,
        pauseOnHover: true,
        loop: true,
        heightPreset: "large",
      };
    }
  }
  return raw;
}

export const heroConfigSchema = z.preprocess(
  normalizeHeroConfig,
  z.object({
    slides: z.array(heroSlideSchema).min(HERO_MIN_SLIDES).max(HERO_MAX_SLIDES),
    autoplay: z.boolean().catch(true),
    intervalMs: heroIntervalMsSchema.catch(5000),
    transition: z.enum(HERO_TRANSITION).catch("fade"),
    showArrows: z.boolean().catch(true),
    showIndicators: z.boolean().catch(true),
    pauseOnHover: z.boolean().catch(true),
    loop: z.boolean().catch(true),
    heightPreset: z.enum(HERO_HEIGHT_PRESET).catch("large"),
  }),
);

/** Helpers puros de edición de placas — los usa el inspector del Hero; viven acá (no en el
 * componente) para poder testearlos sin renderizar React. Ninguno muta el config recibido. */
export function addHeroSlide(config: HeroBlockConfig): HeroBlockConfig {
  if (config.slides.length >= HERO_MAX_SLIDES) return config;
  return { ...config, slides: [...config.slides, createEmptyHeroSlide()] };
}

export function duplicateHeroSlide(config: HeroBlockConfig, slideId: string): HeroBlockConfig {
  const index = config.slides.findIndex((s) => s.id === slideId);
  if (index === -1 || config.slides.length >= HERO_MAX_SLIDES) return config;
  const clone: HeroSlide = { ...config.slides[index], id: generateLocalId() };
  return { ...config, slides: [...config.slides.slice(0, index + 1), clone, ...config.slides.slice(index + 1)] };
}

export function removeHeroSlide(config: HeroBlockConfig, slideId: string): HeroBlockConfig {
  if (config.slides.length <= HERO_MIN_SLIDES) return config;
  return { ...config, slides: config.slides.filter((s) => s.id !== slideId) };
}

export function moveHeroSlide(config: HeroBlockConfig, slideId: string, direction: "up" | "down"): HeroBlockConfig {
  const index = config.slides.findIndex((s) => s.id === slideId);
  if (index === -1) return config;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= config.slides.length) return config;
  const slides = [...config.slides];
  [slides[index], slides[target]] = [slides[target], slides[index]];
  return { ...config, slides };
}

export function updateHeroSlide(config: HeroBlockConfig, slideId: string, patch: Partial<HeroSlide>): HeroBlockConfig {
  return { ...config, slides: config.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)) };
}

export const textConfigSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(8000).optional(),
  align: z.enum(WEBSITE_BLOCK_ALIGN),
});

export const imageConfigSchema = z.object({
  imageUrl: z.string().max(2000).optional(),
  alt: z.string().max(300).optional(),
  caption: z.string().max(300).optional(),
  widthPreset: z.enum(WEBSITE_IMAGE_WIDTH_PRESET),
});

export const ctaConfigSchema = z.object({
  title: z.string().max(200).optional(),
  text: z.string().max(400).optional(),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(2000).optional(),
  stylePreset: z.enum(WEBSITE_CTA_STYLE_PRESET),
});

export const spacerConfigSchema = z.object({
  sizePreset: z.enum(WEBSITE_SPACER_SIZE_PRESET),
});

/**
 * Últimos artículos del blog — el primer bloque `dynamic`: su `config` sólo dice CÓMO mostrar
 * (título, cuántas tarjetas, si va el extracto); los artículos se leen al dibujar la portada,
 * nunca se copian al `sectionsJson`. Así un artículo nuevo aparece solo, sin volver a publicar
 * el sitio. `.catch` en todo: un valor fuera de lo permitido cae al default en vez de descartar
 * el bloque entero.
 */
export const BLOG_LATEST_COUNT_OPTIONS = [3, 6] as const;
export type BlogLatestCount = (typeof BLOG_LATEST_COUNT_OPTIONS)[number];

export const blogLatestConfigSchema = z.object({
  title: z.string().max(200).optional(),
  count: z.union([z.literal(3), z.literal(6)]).catch(3),
  showExcerpt: z.boolean().catch(true),
});

/**
 * "Socio de la semana": la tarjeta del socio destacado de esta semana. Sólo aparece si ese socio
 * dio permiso para mostrarse en público (`directoryOptIn`), y nunca con teléfono ni correo.
 */
export const memberOfWeekConfigSchema = z.object({
  title: z.string().max(200).optional(),
  intro: z.string().max(400).optional(),
});

/**
 * Texto con formato: HTML del editor TipTap del blog, guardado tal cual en `config.html`. Es el
 * único bloque que acepta HTML, así que SIEMPRE pasa por `sanitizeRichTextConfig` — al guardar
 * (`sanitizeBlocksForSave`) y al dibujar (la vista) — y nunca se inserta sin sanear. Ambas viven
 * en `rich-text-sanitize.ts`: este archivo llega al bundle del navegador y no debe cargar el
 * sanitizador de `@repo/content`.
 */
export const WEBSITE_RICH_TEXT_WIDTH = ["narrow", "normal", "wide"] as const;
export type WebsiteRichTextWidth = (typeof WEBSITE_RICH_TEXT_WIDTH)[number];

export const richTextConfigSchema = z.object({
  title: z.string().max(200).optional(),
  html: z.string().max(100000),
  align: z.enum(WEBSITE_BLOCK_ALIGN).catch("left"),
  width: z.enum(WEBSITE_RICH_TEXT_WIDTH).catch("normal"),
});

/**
 * Galería, video y contenido insertado. Las URLs de video y de iframe se guardan como vengan
 * (un bloque recién armado, vacío o a medio escribir, tiene que poder autoguardarse): quien
 * decide si se dibujan es la vista, con `toVideoEmbedUrl` / `isAllowedEmbedUrl`.
 */
export const GALLERY_MAX_PHOTOS = 200;
export const GALLERY_LAYOUTS = ["grid", "masonry"] as const;
export const EMBED_MIN_HEIGHT_PX = 400;
export const EMBED_MAX_HEIGHT_PX = 2000;
export const EMBED_DEFAULT_HEIGHT_PX = 600;

export const galleryPhotoSchema = z.object({
  id: z.string().min(1),
  url: z.string().max(2000),
  alt: z.string().max(300).optional(),
});
export type GalleryPhoto = z.infer<typeof galleryPhotoSchema>;

export const galleryConfigSchema = z.object({
  title: z.string().max(200).optional(),
  photos: z.array(galleryPhotoSchema).max(GALLERY_MAX_PHOTOS),
  layout: z.enum(GALLERY_LAYOUTS).catch("grid"),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).catch(3),
  lightbox: z.boolean().catch(true),
});

export const videoConfigSchema = z.object({
  title: z.string().max(200).optional(),
  url: z.string().max(2000),
});

export const embedConfigSchema = z.object({
  title: z.string().max(200).optional(),
  url: z.string().max(2000),
  heightPx: z.number().int().min(EMBED_MIN_HEIGHT_PX).max(EMBED_MAX_HEIGHT_PX).catch(EMBED_DEFAULT_HEIGHT_PX),
});

/**
 * Contacto: con `useWorkspaceData` los campos vacíos se completan con los datos de la
 * institución al dibujar (ver `resolveContactConfig`); lo escrito acá manda. `mapsUrl` sólo
 * admite enlaces de Google Maps: otro valor se descarta al parsear (no tira el bloque).
 */
export const CONTACT_SOCIAL_NETWORKS = ["instagram", "facebook", "youtube", "vimeo", "tiktok", "linkedin", "pinterest", "x"] as const;
export type ContactSocialNetwork = (typeof CONTACT_SOCIAL_NETWORKS)[number];

export const contactSocialSchema = z.object({
  network: z.enum(CONTACT_SOCIAL_NETWORKS),
  url: z.string().max(2000),
});
export type ContactSocial = z.infer<typeof contactSocialSchema>;

export const contactConfigSchema = z.object({
  title: z.string().max(200).optional(),
  useWorkspaceData: z.boolean().catch(true),
  email: z.string().max(200).optional(),
  phone: z.string().max(60).optional(),
  whatsapp: z.string().max(60).optional(),
  whatsappText: z.string().max(300).optional(),
  address: z.string().max(300).optional(),
  mapsUrl: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v && isAllowedMapsUrl(v) ? v.trim() : undefined)),
  socials: z.array(contactSocialSchema).max(20),
});

/**
 * Formulario de presupuesto: da de alta una consulta en Consultas (el embudo de ventas) desde el
 * sitio. `categoryIds` vacío = todas las categorías activas; las de la lista que se archiven
 * después no rompen nada (ver `categoriasDelBloque` y `resolverCategoriaDelSitio`). Las
 * categorías y los orígenes se leen al dibujar, nunca se copian acá.
 */
export const INQUIRY_DEFAULT_BUTTON_LABEL = "Pedir presupuesto";
export const INQUIRY_DEFAULT_THANKS = "¡Gracias! Te escribimos dentro de las 24 horas.";

export const inquiryFormConfigSchema = z.object({
  title: z.string().max(200).optional().catch(undefined),
  intro: z.string().max(600).optional().catch(undefined),
  categoryIds: z.array(z.string().min(1).max(100)).max(200).catch([]),
  askOrigin: z.boolean().catch(true),
  askEventDate: z.boolean().catch(true),
  askEventLocation: z.boolean().catch(true),
  buttonLabel: z.string().trim().min(1).max(60).catch(INQUIRY_DEFAULT_BUTTON_LABEL),
  thanksMessage: z.string().trim().min(1).max(400).catch(INQUIRY_DEFAULT_THANKS),
});

/**
 * Trabajos (el portfolio del estudio): las tarjetas de los últimos trabajos publicados, de todas
 * las categorías o de una. Como "Últimos artículos", los trabajos se leen al dibujar y nunca se
 * copian acá: un trabajo nuevo aparece solo. `categoriaId` que después se borre u oculte deja el
 * bloque vacío (no se dibuja), nunca roto.
 */
export const PORTFOLIO_COUNT_OPTIONS = [3, 6, 9, 12] as const;
export type PortfolioCount = (typeof PORTFOLIO_COUNT_OPTIONS)[number];
export const PORTFOLIO_LAYOUTS = ["grid", "masonry"] as const;
export const PORTFOLIO_DEFAULT_TITLE = "Trabajos recientes";

export const portfolioConfigSchema = z.object({
  title: z.string().max(200).optional().catch(undefined),
  categoriaId: z.string().min(1).max(100).optional().catch(undefined),
  count: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]).catch(6),
  layout: z.enum(PORTFOLIO_LAYOUTS).catch("grid"),
  showViewAll: z.boolean().catch(true),
});

/**
 * Testimonios: los testimonios PUBLICADOS del estudio (con permiso del autor), en carrusel o en
 * grilla. Como "Trabajos", se leen al dibujar y nunca se copian acá. `count: 0` = todos. Sin ninguno
 * publicado el bloque no se dibuja. `showCta` suma el botón al formulario para dejar uno.
 */
export const TESTIMONIALS_COUNT_OPTIONS = [3, 6, 9, 12, 0] as const;
export type TestimonialsCount = (typeof TESTIMONIALS_COUNT_OPTIONS)[number];
export const TESTIMONIALS_LAYOUTS = ["carousel", "grid"] as const;
export const TESTIMONIALS_DEFAULT_TITLE = "Lo que dicen de nosotros";
export const TESTIMONIALS_DEFAULT_CTA = "Dejá tu testimonio";

export const testimonialsConfigSchema = z.object({
  title: z.string().max(200).optional().catch(undefined),
  count: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12), z.literal(0)]).catch(6),
  layout: z.enum(TESTIMONIALS_LAYOUTS).catch("carousel"),
  showCta: z.boolean().catch(true),
  ctaLabel: z.string().trim().min(1).max(60).catch(TESTIMONIALS_DEFAULT_CTA),
});

/**
 * Bloques del armador sumados para cubrir los elementos de Prosite (divisor, preguntas
 * frecuentes, cuenta regresiva, antes/después, colaboradores, íconos con texto, mapa, botón de
 * WhatsApp y botón de pago). Todos son tolerantes: un valor fuera de lo permitido cae a su
 * default, un texto largo se recorta y un ítem roto de una lista se descarta sin tirar el
 * bloque. Los enlaces externos se validan al parsear (como el `mapsUrl` de Contacto): lo que no
 * es http/https (o https, en el de cobro) se descarta.
 */

/** Texto recortado a `max` caracteres; si no es texto, `fallback`. */
function tolerantText(max: number, fallback = "") {
  return z
    .string()
    .catch(fallback)
    .transform((s) => s.slice(0, max));
}

/** Lista que conserva los ítems válidos (hasta `max`) y descarta los rotos. */
function tolerantList<T extends z.ZodTypeAny>(item: T, max: number) {
  return z
    .unknown()
    .transform((raw) => (Array.isArray(raw) ? raw : []))
    .transform((raw) => {
      const out: z.output<T>[] = [];
      for (const r of raw) {
        if (out.length >= max) break;
        const parsed = item.safeParse(r);
        if (parsed.success) out.push(parsed.data);
      }
      return out;
    });
}

const itemIdSchema = z.string().max(100).catch("");
const imageUrlSchema = tolerantText(2000);

export const DIVIDER_STYLES = ["solid", "dotted", "ornament"] as const;
export const DIVIDER_WIDTHS = ["short", "medium", "full"] as const;

export const dividerConfigSchema = z.object({
  style: z.enum(DIVIDER_STYLES).catch("solid"),
  width: z.enum(DIVIDER_WIDTHS).catch("medium"),
  spacing: z.enum(WEBSITE_SPACER_SIZE_PRESET).catch("md"),
});

export const FAQ_MAX_ITEMS = 40;
export const FAQ_DEFAULT_TITLE = "Preguntas frecuentes";

export const faqItemSchema = z.object({
  id: itemIdSchema,
  question: tolerantText(300),
  answer: tolerantText(3000),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

export const faqConfigSchema = z.object({
  title: tolerantText(200),
  items: tolerantList(faqItemSchema, FAQ_MAX_ITEMS),
});

export const COUNTDOWN_DEFAULT_DONE = "¡Llegó el día!";

export const countdownConfigSchema = z.object({
  title: tolerantText(200),
  /** `YYYY-MM-DD`, hora argentina. Vacío = todavía no se eligió (la vista no dibuja el reloj). */
  date: z
    .string()
    .catch("")
    .transform((s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "")),
  /** `HH:MM` (24 h), hora argentina. */
  time: z
    .string()
    .catch("00:00")
    .transform((s) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : "00:00")),
  doneText: tolerantText(300, COUNTDOWN_DEFAULT_DONE),
});

export const beforeAfterConfigSchema = z.object({
  title: tolerantText(200),
  beforeUrl: imageUrlSchema,
  afterUrl: imageUrlSchema,
  beforeLabel: tolerantText(40, "Antes"),
  afterLabel: tolerantText(40, "Después"),
  alt: tolerantText(300),
});

export const PARTNERS_MAX_ITEMS = 40;
export const PARTNERS_DEFAULT_TITLE = "Colaboradores";

export const partnerItemSchema = z.object({
  id: itemIdSchema,
  imageUrl: imageUrlSchema,
  name: tolerantText(120),
  /** Sólo http/https: cualquier otra cosa se descarta al parsear. */
  url: z
    .string()
    .optional()
    .catch(undefined)
    .transform((v) => externalHttpUrl(v)),
});
export type PartnerItem = z.infer<typeof partnerItemSchema>;

export const partnersConfigSchema = z.object({
  title: tolerantText(200, PARTNERS_DEFAULT_TITLE),
  items: tolerantList(partnerItemSchema, PARTNERS_MAX_ITEMS),
  grayscale: z.boolean().catch(true),
});

/** Set cerrado de íconos (se dibujan con lucide-react en la vista). */
export const FEATURE_ICONS = [
  "camera",
  "image",
  "video",
  "heart",
  "star",
  "award",
  "clock",
  "calendar",
  "map-pin",
  "phone",
  "mail",
  "gift",
  "users",
  "check",
  "sparkles",
  "printer",
  "shield",
  "truck",
] as const;
export type FeatureIcon = (typeof FEATURE_ICONS)[number];
export const FEATURES_MIN_ITEMS = 2;
export const FEATURES_MAX_ITEMS = 6;

export const featureItemSchema = z.object({
  id: itemIdSchema,
  icon: z.enum(FEATURE_ICONS).catch("star"),
  title: tolerantText(120),
  text: tolerantText(500),
});
export type FeatureItem = z.infer<typeof featureItemSchema>;

export const featuresConfigSchema = z.object({
  title: tolerantText(200),
  items: tolerantList(featureItemSchema, FEATURES_MAX_ITEMS),
});

export const MAP_MIN_HEIGHT_PX = 250;
export const MAP_MAX_HEIGHT_PX = 800;
export const MAP_DEFAULT_HEIGHT_PX = 400;

export const mapConfigSchema = z.object({
  title: tolerantText(200),
  /** Dirección («Córdoba 1234, Rosario») o coordenadas («-32.95, -60.64»). */
  query: tolerantText(300),
  heightPx: z.number().int().min(MAP_MIN_HEIGHT_PX).max(MAP_MAX_HEIGHT_PX).catch(MAP_DEFAULT_HEIGHT_PX),
  showDirections: z.boolean().catch(true),
});

export const WHATSAPP_BUTTON_DEFAULT_LABEL = "Escribinos por WhatsApp";

export const whatsappButtonConfigSchema = z.object({
  title: tolerantText(200),
  text: tolerantText(400),
  phone: tolerantText(60),
  buttonLabel: tolerantText(60, WHATSAPP_BUTTON_DEFAULT_LABEL),
  message: tolerantText(300),
  style: z.enum(WEBSITE_CTA_STYLE_PRESET).catch("solid"),
});

export const PAYMENT_BUTTON_DEFAULT_LABEL = "Pagar";
export const PAYMENT_MAX_AMOUNT = 1_000_000_000;

export const paymentButtonConfigSchema = z.object({
  title: tolerantText(200),
  /** Monto en pesos, sólo para mostrar (el cobro lo hace la página del enlace). */
  amount: z.number().int().min(0).max(PAYMENT_MAX_AMOUNT).nullable().catch(null),
  description: tolerantText(600),
  buttonLabel: tolerantText(60, PAYMENT_BUTTON_DEFAULT_LABEL),
  /** Enlace de cobro (Mercado Pago, Cobrador…). Sólo https: otro valor se descarta al parsear. */
  url: z
    .string()
    .catch("")
    .transform((v) => externalHttpsUrl(v) ?? ""),
});

const blockEnvelope = {
  id: z.string().min(1),
  visible: z.boolean(),
  order: z.number().int().min(0),
};

export const heroBlockSchema = z.object({ ...blockEnvelope, type: z.literal("HERO"), config: heroConfigSchema });
export const textBlockSchema = z.object({ ...blockEnvelope, type: z.literal("TEXT"), config: textConfigSchema });
export const imageBlockSchema = z.object({ ...blockEnvelope, type: z.literal("IMAGE"), config: imageConfigSchema });
export const ctaBlockSchema = z.object({ ...blockEnvelope, type: z.literal("CTA"), config: ctaConfigSchema });
export const spacerBlockSchema = z.object({ ...blockEnvelope, type: z.literal("SPACER"), config: spacerConfigSchema });
export const richTextBlockSchema = z.object({ ...blockEnvelope, type: z.literal("RICH_TEXT"), config: richTextConfigSchema });
export const galleryBlockSchema = z.object({ ...blockEnvelope, type: z.literal("GALLERY"), config: galleryConfigSchema });
export const videoBlockSchema = z.object({ ...blockEnvelope, type: z.literal("VIDEO"), config: videoConfigSchema });
export const embedBlockSchema = z.object({ ...blockEnvelope, type: z.literal("EMBED"), config: embedConfigSchema });
export const contactBlockSchema = z.object({ ...blockEnvelope, type: z.literal("CONTACT"), config: contactConfigSchema });
export const inquiryFormBlockSchema = z.object({ ...blockEnvelope, type: z.literal("INQUIRY_FORM"), config: inquiryFormConfigSchema });
export const blogLatestBlockSchema = z.object({ ...blockEnvelope, type: z.literal("BLOG_LATEST"), config: blogLatestConfigSchema });
export const memberOfWeekBlockSchema = z.object({ ...blockEnvelope, type: z.literal("MEMBER_OF_WEEK"), config: memberOfWeekConfigSchema });
export const portfolioBlockSchema = z.object({ ...blockEnvelope, type: z.literal("PORTFOLIO"), config: portfolioConfigSchema });
export const testimonialsBlockSchema = z.object({ ...blockEnvelope, type: z.literal("TESTIMONIALS"), config: testimonialsConfigSchema });
export const dividerBlockSchema = z.object({ ...blockEnvelope, type: z.literal("DIVIDER"), config: dividerConfigSchema });
export const faqBlockSchema = z.object({ ...blockEnvelope, type: z.literal("FAQ"), config: faqConfigSchema });
export const countdownBlockSchema = z.object({ ...blockEnvelope, type: z.literal("COUNTDOWN"), config: countdownConfigSchema });
export const beforeAfterBlockSchema = z.object({ ...blockEnvelope, type: z.literal("BEFORE_AFTER"), config: beforeAfterConfigSchema });
export const partnersBlockSchema = z.object({ ...blockEnvelope, type: z.literal("PARTNERS"), config: partnersConfigSchema });
export const featuresBlockSchema = z.object({ ...blockEnvelope, type: z.literal("FEATURES"), config: featuresConfigSchema });
export const mapBlockSchema = z.object({ ...blockEnvelope, type: z.literal("MAP"), config: mapConfigSchema });
export const whatsappButtonBlockSchema = z.object({ ...blockEnvelope, type: z.literal("WHATSAPP_BUTTON"), config: whatsappButtonConfigSchema });
export const paymentButtonBlockSchema = z.object({ ...blockEnvelope, type: z.literal("PAYMENT_BUTTON"), config: paymentButtonConfigSchema });

export const websiteBlockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  ctaBlockSchema,
  spacerBlockSchema,
  richTextBlockSchema,
  galleryBlockSchema,
  videoBlockSchema,
  embedBlockSchema,
  contactBlockSchema,
  inquiryFormBlockSchema,
  blogLatestBlockSchema,
  memberOfWeekBlockSchema,
  portfolioBlockSchema,
  testimonialsBlockSchema,
  dividerBlockSchema,
  faqBlockSchema,
  countdownBlockSchema,
  beforeAfterBlockSchema,
  partnersBlockSchema,
  featuresBlockSchema,
  mapBlockSchema,
  whatsappButtonBlockSchema,
  paymentButtonBlockSchema,
]);

export const websitePageContentSchema = z.array(websiteBlockSchema);

/** Claves de página admitidas (`home`, `p_1`…): empiezan con letra/número, sin `__proto__` ni rutas. */
export const PAGE_KEY_FORMAT = /^[a-z0-9][a-z0-9_]{0,39}$/;

export const websitePageKeySchema = z.string().regex(PAGE_KEY_FORMAT);

export const websitePageMetaSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  title: z.string().min(1).max(120),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(300).optional(),
});

export type WebsitePageMeta = z.infer<typeof websitePageMetaSchema>;

/** Forma completa de `sectionsJson`. `pageMeta` es hermano de `pages` (no va adentro) para que los
 * lectores viejos, que sólo miran `pages`, lo ignoren sin romperse. Describe las páginas propias;
 * `home` nunca tiene meta. */
export const websiteSectionsSchema = z.object({
  pages: z.record(websitePageKeySchema, websitePageContentSchema),
  pageMeta: z.record(websitePageKeySchema, websitePageMetaSchema),
});

export type HeroBlockConfig = z.infer<typeof heroConfigSchema>;
export type TextBlockConfig = z.infer<typeof textConfigSchema>;
export type ImageBlockConfig = z.infer<typeof imageConfigSchema>;
export type CtaBlockConfig = z.infer<typeof ctaConfigSchema>;
export type SpacerBlockConfig = z.infer<typeof spacerConfigSchema>;
export type RichTextBlockConfig = z.infer<typeof richTextConfigSchema>;
export type GalleryBlockConfig = z.infer<typeof galleryConfigSchema>;
export type VideoBlockConfig = z.infer<typeof videoConfigSchema>;
export type EmbedBlockConfig = z.infer<typeof embedConfigSchema>;
export type ContactBlockConfig = z.infer<typeof contactConfigSchema>;
export type InquiryFormBlockConfig = z.infer<typeof inquiryFormConfigSchema>;
export type BlogLatestBlockConfig = z.infer<typeof blogLatestConfigSchema>;
export type MemberOfWeekBlockConfig = z.infer<typeof memberOfWeekConfigSchema>;
export type PortfolioBlockConfig = z.infer<typeof portfolioConfigSchema>;
export type TestimonialsBlockConfig = z.infer<typeof testimonialsConfigSchema>;
export type DividerBlockConfig = z.infer<typeof dividerConfigSchema>;
export type FaqBlockConfig = z.infer<typeof faqConfigSchema>;
export type CountdownBlockConfig = z.infer<typeof countdownConfigSchema>;
export type BeforeAfterBlockConfig = z.infer<typeof beforeAfterConfigSchema>;
export type PartnersBlockConfig = z.infer<typeof partnersConfigSchema>;
export type FeaturesBlockConfig = z.infer<typeof featuresConfigSchema>;
export type MapBlockConfig = z.infer<typeof mapConfigSchema>;
export type WhatsappButtonBlockConfig = z.infer<typeof whatsappButtonConfigSchema>;
export type PaymentButtonBlockConfig = z.infer<typeof paymentButtonConfigSchema>;

export type HeroBlock = z.infer<typeof heroBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type CtaBlock = z.infer<typeof ctaBlockSchema>;
export type SpacerBlock = z.infer<typeof spacerBlockSchema>;
export type RichTextBlock = z.infer<typeof richTextBlockSchema>;
export type GalleryBlock = z.infer<typeof galleryBlockSchema>;
export type VideoBlock = z.infer<typeof videoBlockSchema>;
export type EmbedBlock = z.infer<typeof embedBlockSchema>;
export type ContactBlock = z.infer<typeof contactBlockSchema>;
export type InquiryFormBlock = z.infer<typeof inquiryFormBlockSchema>;
export type BlogLatestBlock = z.infer<typeof blogLatestBlockSchema>;
export type MemberOfWeekBlock = z.infer<typeof memberOfWeekBlockSchema>;
export type PortfolioBlock = z.infer<typeof portfolioBlockSchema>;
export type TestimonialsBlock = z.infer<typeof testimonialsBlockSchema>;
export type DividerBlock = z.infer<typeof dividerBlockSchema>;
export type FaqBlock = z.infer<typeof faqBlockSchema>;
export type CountdownBlock = z.infer<typeof countdownBlockSchema>;
export type BeforeAfterBlock = z.infer<typeof beforeAfterBlockSchema>;
export type PartnersBlock = z.infer<typeof partnersBlockSchema>;
export type FeaturesBlock = z.infer<typeof featuresBlockSchema>;
export type MapBlock = z.infer<typeof mapBlockSchema>;
export type WhatsappButtonBlock = z.infer<typeof whatsappButtonBlockSchema>;
export type PaymentButtonBlock = z.infer<typeof paymentButtonBlockSchema>;

/** Unión cerrada de los bloques implementados. Bloques con `type` desconocido no matchean acá
 * — el renderer y el editor deben tratarlos como inválidos y omitirlos, nunca romper la página. */
export type WebsiteBlock = z.infer<typeof websiteBlockSchema>;

export type WebsiteBlockType = WebsiteBlock["type"];

/** Bloques de una página pública, en orden. */
export type WebsitePageContent = WebsiteBlock[];

export type WebsiteSections = z.infer<typeof websiteSectionsSchema>;


export function emptyWebsiteSections(): WebsiteSections {
  return { pages: { home: [] }, pageMeta: {} };
}

/**
 * Parseo tolerante de `sectionsJson` tal como viene de la DB (`Json | null`, sin garantía de
 * forma). Un bloque individual inválido no debe tumbar la carga de toda la página, así que se
 * descarta bloque por bloque en vez de fallar la página completa cuando algún bloque no matchea
 * el schema — el resto de bloques válidos se conserva.
 */
export function parseWebsiteSections(raw: unknown): WebsiteSections {
  if (raw === null || typeof raw !== "object") return emptyWebsiteSections();
  const pagesRaw = (raw as { pages?: unknown }).pages;
  if (pagesRaw === null || typeof pagesRaw !== "object") return emptyWebsiteSections();

  const pages: Record<string, WebsiteBlock[]> = {};
  for (const [pageKey, blocksRaw] of Object.entries(pagesRaw as Record<string, unknown>)) {
    if (!Array.isArray(blocksRaw) || !PAGE_KEY_FORMAT.test(pageKey)) continue;
    const validBlocks: WebsiteBlock[] = [];
    for (const blockRaw of blocksRaw) {
      const parsed = websiteBlockSchema.safeParse(blockRaw);
      if (parsed.success) validBlocks.push(parsed.data);
    }
    pages[pageKey] = validBlocks;
  }
  if (!pages.home) pages.home = [];

  // Meta de páginas propias: se descarta la inválida, la de `home` y la que no tiene `pages[clave]`.
  // A su vez, toda página que no sea `home` y no tenga meta válida se descarta (sería inalcanzable).
  const metaRaw = (raw as { pageMeta?: unknown }).pageMeta;
  const pageMeta: Record<string, WebsitePageMeta> = {};
  if (metaRaw !== null && typeof metaRaw === "object") {
    for (const [key, value] of Object.entries(metaRaw as Record<string, unknown>)) {
      if (key === "home" || !Object.hasOwn(pages, key)) continue;
      const parsed = websitePageMetaSchema.safeParse(value);
      if (parsed.success) pageMeta[key] = parsed.data;
    }
  }
  for (const key of Object.keys(pages)) {
    if (key !== "home" && !Object.hasOwn(pageMeta, key)) delete pages[key];
  }
  return { pages, pageMeta };
}

/**
 * Categorías del catálogo de secciones. BASICAS tiene los bloques estáticos y COMUNICACION el
 * primero dinámico (`BLOG_LATEST`, últimos artículos del blog) — el resto queda declarado para que el selector de secciones ya tenga la forma final (categorías
 * agrupadas) sin tener que rediseñarlo cuando se implemente el primer bloque de cada una.
 * INSTITUCION/SOCIOS/ACTIVIDAD/COMERCIAL serán bloques `source: "dynamic"` (resuelven datos
 * de otro módulo vía DTO público, ver `block-contract.ts` y `dynamic-data.ts`).
 */
export const WEBSITE_BLOCK_CATEGORIES = ["BASICAS", "INSTITUCION", "SOCIOS", "ACTIVIDAD", "COMUNICACION", "COMERCIAL"] as const;
export type WebsiteBlockCategory = (typeof WEBSITE_BLOCK_CATEGORIES)[number];

type BlockTypeDefinition<TType extends WebsiteBlockType> = {
  type: TType;
  label: string;
  description: string;
  category: WebsiteBlockCategory;
  /** `dynamic` = resuelve datos de otro módulo en el momento del render (hoy sólo
   * `BLOG_LATEST`, ver `dynamic-data.ts`). Los `static` tienen todo su contenido en `config`. */
  source: "static" | "dynamic";
  defaultConfig: () => Extract<WebsiteBlock, { type: TType }>["config"];
  previewLabel: (config: Extract<WebsiteBlock, { type: TType }>["config"]) => string;
};

/** Registro único de metadata por tipo de bloque — lo consumen el selector "Agregar sección",
 * el listado de tarjetas y el renderer. Agregar un bloque nuevo se hace acá, en un solo lugar
 * (más `block-registry.tsx` para su View/Inspector visual). */
export const WEBSITE_BLOCK_DEFINITIONS: {
  [K in WebsiteBlockType]: BlockTypeDefinition<K>;
} = {
  HERO: {
    type: "HERO",
    label: "Hero / Banner",
    description: "Portada principal — una placa o un carrusel de varias.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({
      slides: [createEmptyHeroSlide()],
      autoplay: true,
      intervalMs: 5000,
      transition: "fade",
      showArrows: true,
      showIndicators: true,
      pauseOnHover: true,
      loop: true,
      heightPreset: "large",
    }),
    // Ojo: este mismo label alimenta el menú de navegación público (`deriveHomeNavItems` en
    // navigation.ts) además del listado de "Secciones" del builder — nunca le agregues acá texto
    // de administración (ej. "· N placas"), terminaría como texto de un item real del menú.
    previewLabel: (c) => c.slides[0]?.title || "Sin título todavía",
  },
  TEXT: {
    type: "TEXT",
    label: "Texto",
    description: "Bloque de contenido.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", content: "", align: "left" }),
    previewLabel: (c) => c.title || (c.content ?? "").slice(0, 60) || "Sin contenido todavía",
  },
  IMAGE: {
    type: "IMAGE",
    label: "Imagen",
    description: "Imagen destacada.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ imageUrl: "", alt: "", caption: "", widthPreset: "full" }),
    previewLabel: (c) => c.caption || c.alt || "Sin imagen todavía",
  },
  CTA: {
    type: "CTA",
    label: "Llamado a la acción",
    description: "Título, descripción y botón.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", text: "", buttonLabel: "", buttonUrl: "", stylePreset: "solid" }),
    previewLabel: (c) => c.title || "Sin título todavía",
  },
  SPACER: {
    type: "SPACER",
    label: "Separador",
    description: "Espacio visual entre secciones.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ sizePreset: "md" }),
    previewLabel: (c) => `Tamaño: ${c.sizePreset === "sm" ? "chico" : c.sizePreset === "lg" ? "grande" : "medio"}`,
  },
  RICH_TEXT: {
    type: "RICH_TEXT",
    label: "Texto con formato",
    description: "Texto con títulos, negritas, listas, enlaces e imágenes.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", html: "", align: "left", width: "normal" }),
    // Alimenta también el menú (ver HERO): sólo el título que puso el dueño, nunca el HTML.
    previewLabel: (c) => c.title?.trim() || "Texto",
  },
  GALLERY: {
    type: "GALLERY",
    label: "Galería de fotos",
    description: "Una grilla de fotos que se pueden ampliar a pantalla completa.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", photos: [], layout: "grid", columns: 3, lightbox: true }),
    // Alimenta también el menú (ver HERO): sin título, "Galería" es lo que el visitante entiende.
    previewLabel: (c) => c.title?.trim() || "Galería",
  },
  VIDEO: {
    type: "VIDEO",
    label: "Video",
    description: "Un video de YouTube o Vimeo.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", url: "" }),
    previewLabel: (c) => c.title?.trim() || "Video",
  },
  EMBED: {
    type: "EMBED",
    label: "Contenido insertado",
    description: "Una página de CompraMeLaFoto, un video o un mapa de Google dentro del sitio.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", url: "", heightPx: EMBED_DEFAULT_HEIGHT_PX }),
    previewLabel: (c) => c.title?.trim() || "Contenido",
  },
  CONTACT: {
    type: "CONTACT",
    label: "Contacto",
    description: "Correo, teléfono, WhatsApp, dirección con mapa y redes. Puede tomar los datos de tu institución.",
    category: "BASICAS",
    source: "dynamic",
    defaultConfig: () => ({ title: "Contacto", useWorkspaceData: true, socials: [] }),
    // Alimenta también el menú (ver HERO).
    previewLabel: (c) => c.title?.trim() || "Contacto",
  },
  INQUIRY_FORM: {
    type: "INQUIRY_FORM",
    label: "Formulario de presupuesto",
    description: "Quien visita el sitio pide presupuesto y la consulta entra sola a Consultas, con su categoría y cómo te conoció.",
    category: "COMERCIAL",
    source: "dynamic",
    defaultConfig: () => ({
      title: "",
      intro: "",
      categoryIds: [],
      askOrigin: true,
      askEventDate: true,
      askEventLocation: true,
      buttonLabel: INQUIRY_DEFAULT_BUTTON_LABEL,
      thanksMessage: INQUIRY_DEFAULT_THANKS,
    }),
    // Alimenta también el menú (ver HERO).
    previewLabel: (c) => c.title?.trim() || "Pedí tu presupuesto",
  },
  BLOG_LATEST: {
    type: "BLOG_LATEST",
    label: "Últimos artículos",
    description: "Las tarjetas de los artículos más recientes del blog, con enlace a cada uno.",
    category: "COMUNICACION",
    source: "dynamic",
    defaultConfig: () => ({ title: "Últimos artículos", count: 3, showExcerpt: true }),
    // Alimenta también el menú (ver HERO): sin título, "Blog" es lo que el visitante entiende.
    previewLabel: (c) => c.title?.trim() || "Blog",
  },
  MEMBER_OF_WEEK: {
    type: "MEMBER_OF_WEEK",
    label: "Socio de la semana",
    description:
      "El socio destacado de esta semana, con lo que contó de sí y sus redes. Sólo aparece si ese socio dio permiso para mostrarse en público.",
    category: "SOCIOS",
    source: "dynamic",
    defaultConfig: () => ({ title: "Socio de la semana", intro: "" }),
    // Alimenta también el menú (ver HERO).
    previewLabel: (c) => c.title?.trim() || "Socio de la semana",
  },
  PORTFOLIO: {
    type: "PORTFOLIO",
    label: "Trabajos",
    description: "Las tarjetas de tus últimos trabajos publicados, de todas las categorías o de una, con enlace a cada uno.",
    category: "COMERCIAL",
    source: "dynamic",
    defaultConfig: () => ({ title: PORTFOLIO_DEFAULT_TITLE, count: 6, layout: "grid", showViewAll: true }),
    // Alimenta también el menú (ver HERO).
    previewLabel: (c) => c.title?.trim() || "Trabajos",
  },
  TESTIMONIALS: {
    type: "TESTIMONIALS",
    label: "Testimonios",
    description: "Lo que tus clientes dicen de vos: los testimonios que publicaste, en carrusel o en grilla, con el botón para dejar uno.",
    category: "COMUNICACION",
    source: "dynamic",
    defaultConfig: () => ({ title: TESTIMONIALS_DEFAULT_TITLE, count: 6, layout: "carousel", showCta: true, ctaLabel: TESTIMONIALS_DEFAULT_CTA }),
    // Alimenta también el menú (ver HERO).
    previewLabel: (c) => c.title?.trim() || "Testimonios",
  },
  DIVIDER: {
    type: "DIVIDER",
    label: "Divisor",
    description: "Una línea para separar secciones: lisa, punteada o con un adorno al medio.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ style: "solid", width: "medium", spacing: "md" }),
    // No entra al menú (ver `deriveHomeNavItems`), como el Separador.
    previewLabel: () => "Divisor",
  },
  FAQ: {
    type: "FAQ",
    label: "Preguntas frecuentes",
    description: "Preguntas con su respuesta, que se abren al tocarlas.",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: FAQ_DEFAULT_TITLE, items: [{ id: generateLocalId(), question: "", answer: "" }] }),
    // Alimenta también el menú (ver HERO).
    previewLabel: (c) => c.title.trim() || FAQ_DEFAULT_TITLE,
  },
  COUNTDOWN: {
    type: "COUNTDOWN",
    label: "Cuenta regresiva",
    description: "Los días, horas y minutos que faltan para una fecha (hora argentina), con un texto para cuando llegue.",
    category: "COMUNICACION",
    source: "static",
    defaultConfig: () => ({ title: "", date: "", time: "00:00", doneText: COUNTDOWN_DEFAULT_DONE }),
    previewLabel: (c) => c.title.trim() || "Cuenta regresiva",
  },
  BEFORE_AFTER: {
    type: "BEFORE_AFTER",
    label: "Antes y después",
    description: "Dos fotos superpuestas con una barra para deslizar y comparar (ideal para retoque o restauración).",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", beforeUrl: "", afterUrl: "", beforeLabel: "Antes", afterLabel: "Después", alt: "" }),
    previewLabel: (c) => c.title.trim() || "Antes y después",
  },
  PARTNERS: {
    type: "PARTNERS",
    label: "Logos de colaboradores",
    description: "Los logos de marcas, sponsors o instituciones con las que trabajás, con enlace a su sitio.",
    category: "COMERCIAL",
    source: "static",
    defaultConfig: () => ({ title: PARTNERS_DEFAULT_TITLE, items: [], grayscale: true }),
    previewLabel: (c) => c.title.trim() || PARTNERS_DEFAULT_TITLE,
  },
  FEATURES: {
    type: "FEATURES",
    label: "Íconos con texto",
    description: "De 2 a 6 ítems, cada uno con un ícono, un título y un texto corto (servicios, ventajas, pasos).",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({
      title: "",
      items: (["camera", "heart", "clock"] as const).map((icon) => ({ id: generateLocalId(), icon, title: "", text: "" })),
    }),
    previewLabel: (c) => c.title.trim() || "Lo que ofrecemos",
  },
  MAP: {
    type: "MAP",
    label: "Mapa",
    description: "Un mapa de Google con tu dirección y el botón «Cómo llegar».",
    category: "BASICAS",
    source: "static",
    defaultConfig: () => ({ title: "", query: "", heightPx: MAP_DEFAULT_HEIGHT_PX, showDirections: true }),
    previewLabel: (c) => c.title.trim() || "Ubicación",
  },
  WHATSAPP_BUTTON: {
    type: "WHATSAPP_BUTTON",
    label: "Botón de WhatsApp",
    description: "Un botón que abre un chat de WhatsApp con tu número y un mensaje ya escrito.",
    category: "COMERCIAL",
    source: "static",
    defaultConfig: () => ({ title: "", text: "", phone: "", buttonLabel: WHATSAPP_BUTTON_DEFAULT_LABEL, message: "", style: "solid" }),
    previewLabel: (c) => c.title.trim() || "WhatsApp",
  },
  PAYMENT_BUTTON: {
    type: "PAYMENT_BUTTON",
    label: "Botón de pago",
    description: "Muestra un monto y un botón que lleva a tu enlace de cobro (Mercado Pago, Cobrador u otro).",
    category: "COMERCIAL",
    source: "static",
    defaultConfig: () => ({ title: "", amount: null, description: "", buttonLabel: PAYMENT_BUTTON_DEFAULT_LABEL, url: "" }),
    previewLabel: (c) => c.title.trim() || "Pagar",
  },
};

export const WEBSITE_BLOCK_TYPES = Object.keys(WEBSITE_BLOCK_DEFINITIONS) as WebsiteBlockType[];

export function createEmptyBlock(type: WebsiteBlockType, order: number): WebsiteBlock {
  const def = WEBSITE_BLOCK_DEFINITIONS[type];
  return { id: generateLocalId(), type, visible: true, order, config: def.defaultConfig() } as WebsiteBlock;
}

export function getBlockPreviewLabel(block: WebsiteBlock): string {
  const def = WEBSITE_BLOCK_DEFINITIONS[block.type] as BlockTypeDefinition<typeof block.type>;
  return def.previewLabel(block.config as never);
}
