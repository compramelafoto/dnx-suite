/**
 * La marca de la institución en el formulario público.
 *
 * Quien llega a esa pantalla le está escribiendo a una ONG que confía en una institución, no a
 * FotOffice. El logo y el color de la institución son lo que confirma que está en el lugar
 * correcto: el enlace se reparte por WhatsApp y quien lo abre no tiene por qué saber qué es
 * FotOffice.
 *
 * Módulo puro y sin dependencias: lo usan el servidor y el componente cliente.
 *
 * **Por qué existe el resguardo de contraste.** El color lo carga cada institución en su
 * branding y nadie revisa que se lea. Un amarillo claro con el texto blanco encima —que es lo
 * que hace hoy `.fo-btn-primary`, con el `#ffffff` escrito a mano— deja el botón de enviar
 * ilegible, y la institución no se entera nunca: ella ve su pantalla, no la de la ONG. Por eso
 * el color del texto se calcula a partir de la luminancia relativa del fondo (WCAG 2.1) en vez
 * de darlo por sentado.
 */

export type Rgb = { r: number; g: number; b: number };

/**
 * `#rrggbb`, `#rgb`, con o sin numeral y con espacios de más.
 *
 * Lo que no es un color se devuelve como `null` en vez de caer en negro: un `null` deja que la
 * pantalla siga con el estilo de siempre, y un negro inventado se ve como una decisión.
 */
export function parseHexColor(raw: string | null | undefined): Rgb | null {
  const t = raw?.trim().replace(/^#/, "");
  if (!t) return null;
  if (!/^[0-9a-fA-F]+$/.test(t)) return null;
  const hex =
    t.length === 3
      ? t
          .split("")
          .map((c) => c + c)
          .join("")
      : t;
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** Luminancia relativa, tal como la define WCAG 2.1. Va de 0 (negro) a 1 (blanco). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const canal = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** La razón de contraste entre dos colores, de 1 (iguales) a 21 (negro contra blanco). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

export const TEXTO_CLARO = "#ffffff";
export const TEXTO_OSCURO = "#000000";

/**
 * Blanco o negro encima de un fondo: el que se lee mejor.
 *
 * No hay un umbral inventado. Se calcula el contraste contra los dos y gana el más alto, que es
 * lo mismo que decir "negro a partir de una luminancia de 0,179". `null` cuando el color falta o
 * no es un color: quien llama cae en el estilo de siempre.
 */
export function colorDeTextoSobre(
  fondo: string | null | undefined,
): typeof TEXTO_CLARO | typeof TEXTO_OSCURO | null {
  const rgb = parseHexColor(fondo);
  if (!rgb) return null;
  const blanco = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
  const negro = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
  return negro > blanco ? TEXTO_OSCURO : TEXTO_CLARO;
}

/** El mismo color con transparencia, para fondos suaves. `null` si no es un color. */
export function colorConAlfa(color: string | null | undefined, alfa: number): string | null {
  const rgb = parseHexColor(color);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alfa})`;
}

/** Los colores ya resueltos que consume la pantalla pública. */
export type CoverageBrand = {
  /** El color principal, normalizado a `#rrggbb`. */
  primary: string;
  /** Blanco o negro: lo que se lee encima del principal. */
  onPrimary: string;
  /** El principal al 12%, para franjas y avisos suaves. */
  soft: string;
  /** El de acento, o el principal si no hay uno usable. */
  accent: string;
};

function aHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * La marca del workspace lista para usar, o `null` si no hay un color válido.
 *
 * `null` no es un error: una institución que nunca cargó colores tiene que seguir viendo el
 * formulario de siempre, entero y legible. La marca es un agregado, no un requisito.
 */
export function resolveCoverageBrand(
  branding: { primaryColor?: string | null; accentColor?: string | null } | null | undefined,
): CoverageBrand | null {
  const principal = parseHexColor(branding?.primaryColor);
  if (!principal) return null;
  const primary = aHex(principal);
  const acento = parseHexColor(branding?.accentColor);
  return {
    primary,
    onPrimary: colorDeTextoSobre(primary) ?? TEXTO_CLARO,
    soft: colorConAlfa(primary, 0.12) ?? "transparent",
    accent: acento ? aHex(acento) : primary,
  };
}
