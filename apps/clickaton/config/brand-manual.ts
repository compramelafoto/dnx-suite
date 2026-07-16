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

/** Paths de descarga en `public/brand/downloads/logos/`. */
export const brandLogoOriginals = {
  principal: "/brand/downloads/logos/clickaton-principal.png",
  colorFondoNegro: "/brand/downloads/logos/clickaton-color-fondo-negro.png",
  monoFondoNegro: "/brand/downloads/logos/clickaton-fondo-negro.png",
  monoFondoBlanco: "/brand/downloads/logos/clickaton-fondo-blanco.png",
  isologotipo: "/brand/downloads/logos/clickaton-isologotipo.png",
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
    id: "principal",
    name: "Logo principal",
    description: "Versión stacked / sticker.",
    previewSurface: "dark",
    previewSrc: brandLogoOriginals.principal,
    downloadHref: brandLogoOriginals.principal,
    downloadFileName: "clickaton-principal.png",
  },
  {
    id: "color-dark",
    name: "Isologotipo color — fondo negro",
    description: "Horizontal a color para fondos oscuros.",
    previewSurface: "dark",
    previewSrc: brandLogoOriginals.colorFondoNegro,
    downloadHref: brandLogoOriginals.colorFondoNegro,
    downloadFileName: "clickaton-color-fondo-negro.png",
  },
  {
    id: "mono-dark",
    name: "Isologotipo mono — fondo negro",
    description: "Monocromo para fondos oscuros.",
    previewSurface: "dark",
    previewSrc: brandLogoOriginals.monoFondoNegro,
    downloadHref: brandLogoOriginals.monoFondoNegro,
    downloadFileName: "clickaton-fondo-negro.png",
  },
  {
    id: "mono-light",
    name: "Isologotipo mono — fondo blanco",
    description: "Monocromo para fondos claros. Preview sobre blanco.",
    previewSurface: "light",
    previewSrc: brandLogoOriginals.monoFondoBlanco,
    downloadHref: brandLogoOriginals.monoFondoBlanco,
    downloadFileName: "clickaton-fondo-blanco.png",
  },
  {
    id: "isologotipo",
    name: "Isologotipo (cámara)",
    description: "Isotipo / marca gráfica.",
    previewSurface: "dark",
    previewSrc: brandLogoOriginals.isologotipo,
    downloadHref: brandLogoOriginals.isologotipo,
    downloadFileName: "clickaton-isologotipo.png",
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
    "Respetá el área libre alrededor del isologotipo (como mínimo la altura de la cámara).",
    "Sobre fondos oscuros: versión color o mono claro. Sobre fondos claros: mono para fondo blanco.",
    "El amarillo `#FFC400` es un golpe visual: CTAs, links, líneas e íconos — nunca el fondo de página.",
    "Tipografía de piezas: Bebas Neue + Montserrat + Caveat según el rol indicado.",
  ],
  dont: [
    "No distorsionar, rotar, cambiar colores ni agregar sombras/glow al logo.",
    "No reconstruir “CLICKATÓN!” con Bebas Neue u otra fuente: el wordmark es asset gráfico.",
    "No usar el isologotipo incorrecto o legacy (versión con tipografía errónea).",
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
