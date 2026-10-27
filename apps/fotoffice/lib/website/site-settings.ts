import { z } from "zod";
import { CONTACT_SOCIAL_NETWORKS } from "./blocks";
import { isHttpsUrl, whatsappHref } from "./contact";

/**
 * Ajustes generales del sitio público (Sitio web → Ajustes): SEO extra, medición, botón flotante
 * de WhatsApp, redes del pie y protección de fotos.
 *
 * Dónde se guardan: `designPresetsJson.siteSettings` del borrador (`FotofficeWorkspaceWebsite`) y,
 * al publicar, se congelan en la versión como el resto del diseño. NO hay columnas nuevas: el
 * esquema se comparte con otras bases y una columna sin aplicar rompe todo el modelo.
 *
 * El constructor (pestaña Diseño) guarda `designPresetsJson` entero con su propio schema, que no
 * conoce esta clave: `saveWebsiteBlocksAction` la conserva con `keepSiteSettings`.
 *
 * Lectura tolerante (`.catch` campo por campo): un sitio viejo (SFPR, Gus Barbers) sin esta clave,
 * o con un valor roto, se lee con los defaults, que equivalen a "como estaba antes".
 */

export const SITE_SETTINGS_KEY = "siteSettings";

/** Las redes del bloque Contacto más Flickr (Prosite la ofrece y DNX la usa). */
export const SITE_SOCIAL_NETWORKS = [...CONTACT_SOCIAL_NETWORKS, "flickr"] as const;
export type SiteSocialNetwork = (typeof SITE_SOCIAL_NETWORKS)[number];

export const SITE_SOCIAL_LABELS: Record<SiteSocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  x: "X (Twitter)",
  flickr: "Flickr",
};

export const WHATSAPP_BUTTON_SIDES = ["left", "right"] as const;
export type WhatsappButtonSide = (typeof WHATSAPP_BUTTON_SIDES)[number];
export const WHATSAPP_BUTTON_SIZES = ["sm", "md", "lg"] as const;
export type WhatsappButtonSize = (typeof WHATSAPP_BUTTON_SIZES)[number];
/** Diámetro del botón en píxeles. El chico respeta igual el mínimo táctil de 44 px. */
export const WHATSAPP_BUTTON_SIZE_PX: Record<WhatsappButtonSize, number> = { sm: 48, md: 56, lg: 64 };

/** Formatos aceptados. Se validan al guardar y otra vez al leer: lo que no cumple no llega al HTML. */
export const GA4_ID_RE = /^G-[A-Z0-9]{4,20}$/;
export const META_PIXEL_ID_RE = /^\d{6,20}$/;
export const GOOGLE_VERIFICATION_RE = /^[A-Za-z0-9_-]{10,100}$/;

export const MAX_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 60;
export const MAX_SOCIAL_LINKS = 20;

export type SiteSocialLink = { network: SiteSocialNetwork; url: string };

export type WebsiteSiteSettings = {
  seo: {
    keywords: string[];
    /** Imagen al compartir de todo el sitio. `null` = la de siempre (logo o portada). */
    shareImageUrl: string | null;
    /** Sólo el valor del `content` de la meta `google-site-verification`. */
    googleVerification: string | null;
  };
  analytics: {
    ga4Id: string | null;
    metaPixelId: string | null;
  };
  whatsappButton: {
    enabled: boolean;
    number: string;
    /** Globito de bienvenida al lado del botón (opcional, se puede cerrar). */
    welcomeMessage: string;
    /** Texto que aparece escrito en el chat al abrirlo. */
    chatText: string;
    side: WhatsappButtonSide;
    size: WhatsappButtonSize;
  };
  socialLinks: SiteSocialLink[];
  photoProtection: { enabled: boolean };
};

export const DEFAULT_SITE_SETTINGS: WebsiteSiteSettings = {
  seo: { keywords: [], shareImageUrl: null, googleVerification: null },
  analytics: { ga4Id: null, metaPixelId: null },
  whatsappButton: { enabled: false, number: "", welcomeMessage: "", chatText: "", side: "right", size: "md" },
  socialLinks: [],
  photoProtection: { enabled: false },
};

/** Normaliza palabras clave: sin espacios de más, sin vacías, sin repetidas (ignorando mayúsculas). */
export function normalizeKeywords(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of raw) {
    const clean = k.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > MAX_KEYWORD_LENGTH) continue;
    const key = clean.toLocaleLowerCase("es");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

/** «fotografía, bodas,  rosario» → ["fotografía", "bodas", "rosario"]. */
export function keywordsFromText(text: string): string[] {
  return normalizeKeywords(text.split(/[,\n]/));
}

const httpsOrNull = z
  .unknown()
  .transform((v) => (typeof v === "string" && v.length <= 2000 && isHttpsUrl(v) ? v.trim() : null));

const matchOrNull = (re: RegExp) =>
  z.unknown().transform((v) => (typeof v === "string" && re.test(v.trim()) ? v.trim() : null));

const socialLinkSchema = z.object({
  network: z.enum(SITE_SOCIAL_NETWORKS),
  url: z.string().max(2000).refine(isHttpsUrl),
});

const D = DEFAULT_SITE_SETTINGS;

/** Schema TOLERANTE de lectura: nunca falla, cae a defaults campo por campo. */
export const websiteSiteSettingsSchema = z.object({
  seo: z
    .object({
      keywords: z
        .array(z.unknown())
        .transform((arr) => normalizeKeywords(arr.filter((k): k is string => typeof k === "string")))
        .catch([]),
      shareImageUrl: httpsOrNull,
      googleVerification: matchOrNull(GOOGLE_VERIFICATION_RE),
    })
    .catch(D.seo),
  analytics: z
    .object({
      ga4Id: matchOrNull(GA4_ID_RE),
      metaPixelId: matchOrNull(META_PIXEL_ID_RE),
    })
    .catch(D.analytics),
  whatsappButton: z
    .object({
      enabled: z.boolean().catch(false),
      number: z.string().max(60).catch(""),
      welcomeMessage: z.string().max(200).catch(""),
      chatText: z.string().max(300).catch(""),
      side: z.enum(WHATSAPP_BUTTON_SIDES).catch("right"),
      size: z.enum(WHATSAPP_BUTTON_SIZES).catch("md"),
    })
    .catch(D.whatsappButton),
  // Un enlace roto se descarta solo; no se lleva puestos a los demás.
  socialLinks: z
    .array(z.unknown())
    .transform((arr) =>
      arr
        .map((item) => socialLinkSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => ({ network: r.data!.network, url: r.data!.url.trim() }))
        .slice(0, MAX_SOCIAL_LINKS),
    )
    .catch([]),
  photoProtection: z.object({ enabled: z.boolean().catch(false) }).catch(D.photoProtection),
});

/** Lee los ajustes desde el `designPresetsJson` crudo (borrador o versión publicada). */
export function parseWebsiteSiteSettings(designPresetsJson: unknown): WebsiteSiteSettings {
  if (designPresetsJson === null || typeof designPresetsJson !== "object") return DEFAULT_SITE_SETTINGS;
  const raw = (designPresetsJson as Record<string, unknown>)[SITE_SETTINGS_KEY];
  if (raw === null || typeof raw !== "object") return DEFAULT_SITE_SETTINGS;
  const parsed = websiteSiteSettingsSchema.safeParse(raw);
  return parsed.success ? (parsed.data as WebsiteSiteSettings) : DEFAULT_SITE_SETTINGS;
}

/**
 * Validación ESTRICTA de lo que manda el panel al guardar: a diferencia de la lectura, acá un
 * valor mal escrito no se corrige en silencio, se le explica a la persona qué falta.
 */
export function validateSiteSettingsInput(input: unknown): { settings: WebsiteSiteSettings } | { error: string } {
  if (input === null || typeof input !== "object") return { error: "Los ajustes enviados no tienen un formato válido." };
  const i = input as Record<string, Record<string, unknown> | unknown[] | undefined>;
  const seo = (i.seo ?? {}) as Record<string, unknown>;
  const analytics = (i.analytics ?? {}) as Record<string, unknown>;
  const wa = (i.whatsappButton ?? {}) as Record<string, unknown>;
  const photo = (i.photoProtection ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const keywordsRaw = Array.isArray(seo.keywords) ? seo.keywords.filter((k): k is string => typeof k === "string") : [];
  if (keywordsRaw.some((k) => k.trim().length > MAX_KEYWORD_LENGTH)) {
    return { error: `Cada palabra clave puede tener hasta ${MAX_KEYWORD_LENGTH} letras.` };
  }
  const distintas = new Set(keywordsRaw.map((k) => k.replace(/\s+/g, " ").trim().toLocaleLowerCase("es")).filter(Boolean));
  if (distintas.size > MAX_KEYWORDS) return { error: `Podés cargar hasta ${MAX_KEYWORDS} palabras clave.` };
  const keywords = normalizeKeywords(keywordsRaw);

  const shareImageUrl = str(seo.shareImageUrl) || null;
  if (shareImageUrl && !isHttpsUrl(shareImageUrl)) return { error: "La imagen al compartir tiene que ser un enlace https." };

  const googleVerification = str(seo.googleVerification) || null;
  if (googleVerification && !GOOGLE_VERIFICATION_RE.test(googleVerification)) {
    return {
      error:
        "El código de verificación de Google no es válido. Pegá sólo el código (lo que va entre comillas en content=\"…\"), sin la etiqueta entera.",
    };
  }

  const ga4Id = str(analytics.ga4Id).toUpperCase() || null;
  if (ga4Id && !GA4_ID_RE.test(ga4Id)) {
    return { error: "El ID de Google Analytics tiene que empezar con G- (por ejemplo, G-ABC123XYZ)." };
  }
  const metaPixelId = str(analytics.metaPixelId) || null;
  if (metaPixelId && !META_PIXEL_ID_RE.test(metaPixelId)) {
    return { error: "El píxel de Meta es sólo un número (entre 6 y 20 cifras)." };
  }

  const enabled = wa.enabled === true;
  const number = str(wa.number);
  if (number.length > 60) return { error: "El número de WhatsApp es demasiado largo." };
  if (enabled && !whatsappHref(number)) {
    return { error: "Para mostrar el botón de WhatsApp, cargá un número válido (con código de área)." };
  }
  const welcomeMessage = str(wa.welcomeMessage);
  if (welcomeMessage.length > 200) return { error: "El mensaje de bienvenida puede tener hasta 200 letras." };
  const chatText = str(wa.chatText);
  if (chatText.length > 300) return { error: "El texto inicial del chat puede tener hasta 300 letras." };
  const side = (WHATSAPP_BUTTON_SIDES as readonly string[]).includes(str(wa.side)) ? (str(wa.side) as WhatsappButtonSide) : "right";
  const size = (WHATSAPP_BUTTON_SIZES as readonly string[]).includes(str(wa.size)) ? (str(wa.size) as WhatsappButtonSize) : "md";

  const linksRaw = Array.isArray(i.socialLinks) ? i.socialLinks : [];
  const socialLinks: SiteSocialLink[] = [];
  for (const item of linksRaw) {
    if (item === null || typeof item !== "object") continue;
    const { network, url } = item as { network?: unknown; url?: unknown };
    const u = str(url);
    if (!u) continue;
    if (!(SITE_SOCIAL_NETWORKS as readonly unknown[]).includes(network)) return { error: "Una de las redes no es válida." };
    if (!isHttpsUrl(u)) {
      return { error: `El enlace de ${SITE_SOCIAL_LABELS[network as SiteSocialNetwork]} tiene que empezar con https://.` };
    }
    socialLinks.push({ network: network as SiteSocialNetwork, url: u });
  }
  if (socialLinks.length > MAX_SOCIAL_LINKS) return { error: `Podés cargar hasta ${MAX_SOCIAL_LINKS} redes.` };

  return {
    settings: {
      seo: { keywords, shareImageUrl, googleVerification },
      analytics: { ga4Id, metaPixelId },
      whatsappButton: { enabled, number, welcomeMessage, chatText, side, size },
      socialLinks,
      photoProtection: { enabled: photo.enabled === true },
    },
  };
}

/** `designPresetsJson` nuevo: el actual con los ajustes reemplazados (el resto del diseño intacto). */
export function withSiteSettings(currentDesignPresetsJson: unknown, settings: WebsiteSiteSettings): Record<string, unknown> {
  const base =
    currentDesignPresetsJson !== null && typeof currentDesignPresetsJson === "object" && !Array.isArray(currentDesignPresetsJson)
      ? (currentDesignPresetsJson as Record<string, unknown>)
      : {};
  return { ...base, [SITE_SETTINGS_KEY]: settings };
}

/**
 * El diseño que guarda el constructor, conservando los ajustes que ya había en la base: el
 * constructor no los conoce y, sin esto, cada autoguardado de Diseño los borraría.
 */
export function keepSiteSettings(newPresets: Record<string, unknown>, currentDesignPresetsJson: unknown): Record<string, unknown> {
  const { [SITE_SETTINGS_KEY]: _ignorado, ...rest } = newPresets;
  void _ignorado;
  if (currentDesignPresetsJson === null || typeof currentDesignPresetsJson !== "object") return rest;
  const actual = (currentDesignPresetsJson as Record<string, unknown>)[SITE_SETTINGS_KEY];
  return actual === undefined ? rest : { ...rest, [SITE_SETTINGS_KEY]: actual };
}

/* ── Medición ─────────────────────────────────────────────────────────────────────────────────── */

export type TrackingScript = { id: string; src?: string; inline?: string };

/**
 * Los scripts de medición que arma FOTOFFICE. Nunca HTML/JS libre: el único dato de la persona que
 * entra al script es el ID, validado con regex y además pasado por `JSON.stringify`.
 */
export function buildTrackingScripts(analytics: WebsiteSiteSettings["analytics"]): TrackingScript[] {
  const out: TrackingScript[] = [];
  const ga4 = analytics.ga4Id && GA4_ID_RE.test(analytics.ga4Id) ? analytics.ga4Id : null;
  const pixel = analytics.metaPixelId && META_PIXEL_ID_RE.test(analytics.metaPixelId) ? analytics.metaPixelId : null;
  if (ga4) {
    out.push({ id: "fo-ga4-src", src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}` });
    out.push({
      id: "fo-ga4-init",
      // Sin la vista automática: `SiteTracking` la manda a mano sólo en direcciones permitidas.
      // Esta primera va acá porque el script se monta recién en una dirección permitida.
      inline:
        "window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('js',new Date());" +
        `gtag('config',${JSON.stringify(ga4)},{send_page_view:false});gtag('event','page_view');`,
    });
  }
  if (pixel) {
    out.push({
      id: "fo-meta-pixel",
      inline:
        "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};" +
        "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;" +
        "s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
        `fbq('init',${JSON.stringify(pixel)});fbq('track','PageView');`,
    });
  }
  return out;
}

/**
 * Páginas públicas con un token personal en la dirección: pedido, recibo, contrato, galería,
 * videos, presupuesto, archivos, permiso del autor, seguimiento de impresión, pedido de la tienda,
 * el testimonio personal (`/testimonio?t=…`) y la vuelta del pago de un curso
 * (`/cursos/<curso>/inscripcion/…`). Ahí NO se mide nada: Google o Meta recibirían el enlace con
 * el token. Además, cualquier dirección con un parámetro sensible en la consulta queda afuera.
 * Sirve con y sin el prefijo `/w/<slug>` (dominio propio).
 */
const TOKEN_SEGMENTS = new Set(["pedido", "recibo", "contrato", "galeria", "videos", "presupuesto", "archivos", "impresion"]);

/** Parámetros de consulta que identifican a una persona, un pago o un enlace personal. */
export const SENSITIVE_QUERY_PARAMS = new Set([
  "t",
  "token",
  "enrollmentid",
  "payment_id",
  "collection_id",
  "preference_id",
  "merchant_order_id",
  "external_reference",
  "publicid",
  "code",
  "key",
  "sig",
  "signature",
  "email",
]);

export function isTrackingExcludedPath(pathname: string, search = ""): boolean {
  const [ruta, consultaEnRuta = ""] = pathname.split("?");
  const consulta = new URLSearchParams(search || consultaEnRuta);
  for (const clave of consulta.keys()) {
    if (SENSITIVE_QUERY_PARAMS.has(clave.toLowerCase())) return true;
  }

  let segs = ruta.split("/").filter(Boolean);
  if (segs[0] === "w" && segs.length >= 2) segs = segs.slice(2);
  if (segs[0] === "testimonio") return true;
  if (segs[0] === "cursos" && segs[2] === "inscripcion") return true;
  if (segs.length < 2) return false;
  if (TOKEN_SEGMENTS.has(segs[0])) return true;
  if (segs[0] === "obras" && segs[1] === "permiso") return true;
  if (segs[0] === "tienda" && segs[1] === "pedido") return true;
  return false;
}
