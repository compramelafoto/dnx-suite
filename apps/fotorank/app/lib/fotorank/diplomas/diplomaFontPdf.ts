import { readFileSync } from "node:fs";
import path from "node:path";
import type { DiplomaFontId } from "./diplomaFonts";

/** Variante tipográfica para PDF (4 combinaciones peso × cursiva). */
export type DiplomaPdfFontSlot = "normal" | "bold" | "italic" | "boldItalic";

/**
 * Lectura en runtime para no meter WOFF en el grafo del bundler.
 * Fuentes sin cursiva en el paquete reutilizan el archivo normal o negrita.
 * Scripts de una sola peso reutilizan 400 en todos los slots.
 */
const DIPLOMA_FONT_FILES: Record<
  DiplomaFontId,
  { pkg: string; normal: string; bold: string; italic: string; boldItalic: string }
> = {
  dmSans: {
    pkg: "@fontsource/dm-sans",
    normal: "dm-sans-latin-400-normal.woff",
    bold: "dm-sans-latin-700-normal.woff",
    italic: "dm-sans-latin-400-italic.woff",
    boldItalic: "dm-sans-latin-700-italic.woff",
  },
  inter: {
    pkg: "@fontsource/inter",
    normal: "inter-latin-400-normal.woff",
    bold: "inter-latin-700-normal.woff",
    italic: "inter-latin-400-italic.woff",
    boldItalic: "inter-latin-700-italic.woff",
  },
  outfit: {
    pkg: "@fontsource/outfit",
    normal: "outfit-latin-400-normal.woff",
    bold: "outfit-latin-700-normal.woff",
    italic: "outfit-latin-400-normal.woff",
    boldItalic: "outfit-latin-700-normal.woff",
  },
  manrope: {
    pkg: "@fontsource/manrope",
    normal: "manrope-latin-400-normal.woff",
    bold: "manrope-latin-700-normal.woff",
    italic: "manrope-latin-400-normal.woff",
    boldItalic: "manrope-latin-700-normal.woff",
  },
  plusJakartaSans: {
    pkg: "@fontsource/plus-jakarta-sans",
    normal: "plus-jakarta-sans-latin-400-normal.woff",
    bold: "plus-jakarta-sans-latin-700-normal.woff",
    italic: "plus-jakarta-sans-latin-400-italic.woff",
    boldItalic: "plus-jakarta-sans-latin-700-italic.woff",
  },
  playfairDisplay: {
    pkg: "@fontsource/playfair-display",
    normal: "playfair-display-latin-400-normal.woff",
    bold: "playfair-display-latin-700-normal.woff",
    italic: "playfair-display-latin-400-italic.woff",
    boldItalic: "playfair-display-latin-700-italic.woff",
  },
  merriweather: {
    pkg: "@fontsource/merriweather",
    normal: "merriweather-latin-400-normal.woff",
    bold: "merriweather-latin-700-normal.woff",
    italic: "merriweather-latin-400-italic.woff",
    boldItalic: "merriweather-latin-700-italic.woff",
  },
  lora: {
    pkg: "@fontsource/lora",
    normal: "lora-latin-400-normal.woff",
    bold: "lora-latin-700-normal.woff",
    italic: "lora-latin-400-italic.woff",
    boldItalic: "lora-latin-700-italic.woff",
  },
  cinzel: {
    pkg: "@fontsource/cinzel",
    normal: "cinzel-latin-400-normal.woff",
    bold: "cinzel-latin-700-normal.woff",
    italic: "cinzel-latin-400-normal.woff",
    boldItalic: "cinzel-latin-700-normal.woff",
  },
  sourceSerif4: {
    pkg: "@fontsource/source-serif-4",
    normal: "source-serif-4-latin-400-normal.woff",
    bold: "source-serif-4-latin-700-normal.woff",
    italic: "source-serif-4-latin-400-italic.woff",
    boldItalic: "source-serif-4-latin-700-italic.woff",
  },
  libreBaskerville: {
    pkg: "@fontsource/libre-baskerville",
    normal: "libre-baskerville-latin-400-normal.woff",
    bold: "libre-baskerville-latin-700-normal.woff",
    italic: "libre-baskerville-latin-400-italic.woff",
    boldItalic: "libre-baskerville-latin-700-italic.woff",
  },
  cormorantGaramond: {
    pkg: "@fontsource/cormorant-garamond",
    normal: "cormorant-garamond-latin-400-normal.woff",
    bold: "cormorant-garamond-latin-700-normal.woff",
    italic: "cormorant-garamond-latin-400-italic.woff",
    boldItalic: "cormorant-garamond-latin-700-italic.woff",
  },
  ebGaramond: {
    pkg: "@fontsource/eb-garamond",
    normal: "eb-garamond-latin-400-normal.woff",
    bold: "eb-garamond-latin-700-normal.woff",
    italic: "eb-garamond-latin-400-italic.woff",
    boldItalic: "eb-garamond-latin-700-italic.woff",
  },
  spectral: {
    pkg: "@fontsource/spectral",
    normal: "spectral-latin-400-normal.woff",
    bold: "spectral-latin-700-normal.woff",
    italic: "spectral-latin-400-italic.woff",
    boldItalic: "spectral-latin-700-italic.woff",
  },
  dancingScript: {
    pkg: "@fontsource/dancing-script",
    normal: "dancing-script-latin-400-normal.woff",
    bold: "dancing-script-latin-700-normal.woff",
    italic: "dancing-script-latin-400-normal.woff",
    boldItalic: "dancing-script-latin-700-normal.woff",
  },
  greatVibes: {
    pkg: "@fontsource/great-vibes",
    normal: "great-vibes-latin-400-normal.woff",
    bold: "great-vibes-latin-400-normal.woff",
    italic: "great-vibes-latin-400-normal.woff",
    boldItalic: "great-vibes-latin-400-normal.woff",
  },
  allura: {
    pkg: "@fontsource/allura",
    normal: "allura-latin-400-normal.woff",
    bold: "allura-latin-400-normal.woff",
    italic: "allura-latin-400-normal.woff",
    boldItalic: "allura-latin-400-normal.woff",
  },
  satisfy: {
    pkg: "@fontsource/satisfy",
    normal: "satisfy-latin-400-normal.woff",
    bold: "satisfy-latin-400-normal.woff",
    italic: "satisfy-latin-400-normal.woff",
    boldItalic: "satisfy-latin-400-normal.woff",
  },
  caveat: {
    pkg: "@fontsource/caveat",
    normal: "caveat-latin-400-normal.woff",
    bold: "caveat-latin-700-normal.woff",
    italic: "caveat-latin-400-normal.woff",
    boldItalic: "caveat-latin-700-normal.woff",
  },
  sacramento: {
    pkg: "@fontsource/sacramento",
    normal: "sacramento-latin-400-normal.woff",
    bold: "sacramento-latin-400-normal.woff",
    italic: "sacramento-latin-400-normal.woff",
    boldItalic: "sacramento-latin-400-normal.woff",
  },
};

/** Solo servidor (render PDF). Lee WOFF empaquetado en node_modules/@fontsource. */
export function readDiplomaPdfFontBytes(id: DiplomaFontId, slot: DiplomaPdfFontSlot): Uint8Array {
  const def = DIPLOMA_FONT_FILES[id];
  const file = def[slot];
  const abs = path.join(process.cwd(), "node_modules", def.pkg, "files", file);
  return new Uint8Array(readFileSync(abs));
}
