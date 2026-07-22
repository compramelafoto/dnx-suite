/**
 * Contenido del Manual de Marca online (/manualdemarca).
 * Los logos son archivos ORIGINALES (sin procesar). Preview = descarga.
 */

import { brandAssetPaths } from "@/config/brand-assets";

export const brandManualMeta = {
  title: "Manual de marca",
  description:
    "Identidad visual oficial de Clickatón — logos, colores y tipografías para sedes, sponsors y diseñadores. Descargá assets listos para usar.",
  path: "/manualdemarca",
} as const;

/** Paths de descarga en `public/brand/downloads/logos/` (PNG originales con transparencia). */
export const brandLogoOriginals = {
  principalV3Color: "/brand/downloads/logos/clickaton-principal-v3-color.png",
  principalV2Color: "/brand/downloads/logos/clickaton-principal-v2-color.png",
  principalV2Mono: "/brand/downloads/logos/clickaton-principal-v2-mono.png",
} as const;

export type BrandLogoDownload = {
  id: string;
  name: string;
  description: string;
  previewSurface: "dark" | "light";
  previewSrc: string;
  downloadHref: string;
  downloadFileName: string;
};

export const brandLogoDownloads: readonly BrandLogoDownload[] = [
  {
    id: "principal-v3-color",
    name: "Logo principal — color V3",
    description:
      "Versión sticker a color (CLICK en amarillo). PNG con fondo transparente.",
    previewSurface: "dark",
    previewSrc: brandLogoOriginals.principalV3Color,
    downloadHref: brandLogoOriginals.principalV3Color,
    downloadFileName: "clickaton-principal-v3-color.png",
  },
  {
    id: "principal-v2-color",
    name: "Logo principal — color V2",
    description:
      "Versión sticker a color (ATÓN! en amarillo). PNG con fondo transparente.",
    previewSurface: "dark",
    previewSrc: brandLogoOriginals.principalV2Color,
    downloadHref: brandLogoOriginals.principalV2Color,
    downloadFileName: "clickaton-principal-v2-color.png",
  },
  {
    id: "principal-v2-mono",
    name: "Logo principal — mono",
    description:
      "Versión sticker monocromática. PNG con fondo transparente.",
    previewSurface: "dark",
    previewSrc: brandLogoOriginals.principalV2Mono,
    downloadHref: brandLogoOriginals.principalV2Mono,
    downloadFileName: "clickaton-principal-v2-mono.png",
  },
] as const;

export const brandPackDownloads = {
  logosZip: {
    href: "/brand/downloads/clickaton-logos.zip",
    fileName: "clickaton-logos.zip",
    label: "Descargar pack de logos (ZIP)",
  },
  fontsZip: {
    href: "/brand/downloads/clickaton-tipografias.zip",
    fileName: "clickaton-tipografias.zip",
    label: "Descargar tipografías (ZIP)",
  },
} as const;

export type BrandColorSwatch = {
  name: string;
  role: string;
  hex: string;
  token: string;
};

export const brandCoreColors: readonly BrandColorSwatch[] = [
  {
    name: "Negro profundo",
    role: "Fondo principal de la web y piezas editoriales",
    hex: "#111111",
    token: "--ck-core-black",
  },
  {
    name: "Gris oscuro",
    role: "Superficies, cards y paneles",
    hex: "#1B1B1B",
    token: "--ck-core-gray-dark",
  },
  {
    name: "Gris medio",
    role: "Elevaciones y hovers",
    hex: "#2A2A2A",
    token: "--ck-core-gray-mid",
  },
  {
    name: "Blanco",
    role: "Texto primario y contraste",
    hex: "#FFFFFF",
    token: "--ck-core-white",
  },
  {
    name: "Texto secundario",
    role: "Body, descripciones y ayudas",
    hex: "#B9B9B9",
    token: "--ck-core-text-secondary",
  },
  {
    name: "Amarillo Clickatón",
    role: "Acento de marca — CTA, links, líneas, íconos",
    hex: "#FFC400",
    token: "--ck-core-brand",
  },
] as const;

export const brandSupportColors: readonly BrandColorSwatch[] = [
  {
    name: "Violeta comunidad",
    role: "Comunidad y acentos secundarios",
    hex: "#6C53FF",
    token: "--ck-brand-violet",
  },
  {
    name: "Azul tecnología",
    role: "Estados info / tech",
    hex: "#00AEEF",
    token: "--ck-brand-blue",
  },
  {
    name: "Verde éxito",
    role: "Confirmaciones",
    hex: "#4CAF50",
    token: "--ck-brand-green",
  },
  {
    name: "Peligro",
    role: "Errores y alertas",
    hex: "#FF5C5C",
    token: "--ck-danger",
  },
] as const;

export type BrandFontSpec = {
  id: string;
  name: string;
  role: string;
  sample: string;
  sampleClassName: string;
  usage: string;
  downloadHref: string;
  downloadFileName: string;
  googleFontsUrl: string;
};

export const brandFonts: readonly BrandFontSpec[] = [
  {
    id: "bebas",
    name: "Bebas Neue",
    role: "Display / títulos",
    sample: "SALÍ A BUSCAR EL INSTANTE",
    sampleClassName: "ck-display-lg text-ck-text",
    usage: "Titulares, hero y headings en mayúsculas. No usar para simular el wordmark del logo.",
    downloadHref: "/brand/downloads/fonts/Bebas_Neue.zip",
    downloadFileName: "Bebas_Neue.zip",
    googleFontsUrl: "https://fonts.google.com/specimen/Bebas+Neue",
  },
  {
    id: "montserrat",
    name: "Montserrat",
    role: "UI / cuerpo",
    sample:
      "Una experiencia fotográfica que combina creatividad, desafío y comunidad.",
    sampleClassName: "ck-body-lg text-ck-text-secondary",
    usage: "Textos de interfaz, párrafos, botones y formularios.",
    downloadHref: "/brand/downloads/fonts/Montserrat.zip",
    downloadFileName: "Montserrat.zip",
    googleFontsUrl: "https://fonts.google.com/specimen/Montserrat",
  },
  {
    id: "caveat",
    name: "Caveat",
    role: "Acento editorial",
    sample: "Salí. Encontrá. Compartí.",
    sampleClassName: "ck-accent-script text-3xl text-ck-text-secondary md:text-4xl",
    usage: "Frases cortas, firmas editoriales. Usar con moderación.",
    downloadHref: "/brand/downloads/fonts/Caveat.zip",
    downloadFileName: "Caveat.zip",
    googleFontsUrl: "https://fonts.google.com/specimen/Caveat",
  },
] as const;

export const brandUsageRules = {
  do: [
    "Usá siempre los PNG oficiales descargables (no redibujar ni tipografiar el logo).",
    "Respetá el área libre alrededor del logo (como mínimo la altura de la cámara).",
    "Los tres logos principales tienen fondo transparente: usalos sobre oscuro o claro según contraste.",
    "El amarillo `#FFC400` es un golpe visual: CTAs, links, líneas e íconos — nunca el fondo de página.",
    "Tipografía de piezas: Bebas Neue + Montserrat + Caveat según el rol indicado.",
  ],
  dont: [
    "No distorsionar, rotar, cambiar colores ni agregar sombras/glow al logo.",
    "No reconstruir “CLICKATÓN!” con Bebas Neue u otra fuente: el wordmark es asset gráfico.",
    "No aplastar ni recortar el contorno blanco del sticker.",
    "No llenar héroes o fondos enteros de amarillo.",
    "No mezclar con paletas ajenas (terracota, púrpura SaaS genérico, etc.).",
  ],
} as const;

export const brandManualSections = [
  { id: "logos", label: "Logos" },
  { id: "colores", label: "Colores" },
  { id: "tipografias", label: "Tipografías" },
  { id: "uso", label: "Uso correcto" },
  { id: "packs", label: "Packs" },
] as const;

/** @deprecated Prefer brandAssetPaths — reexport for convenience in manual copy. */
export { brandAssetPaths };
