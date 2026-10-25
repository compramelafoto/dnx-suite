/**
 * Colores propios del panel de un negocio (DNX Estudio, 18/10/2026). Módulo PURO.
 *
 * Con `panelColor` vacío el panel usa los colores de FOTOFFICE (`app/globals.css`) y nada
 * cambia. Con un color: menú lateral negro, acento de la marca (botones, selección, contadores)
 * con el texto encima en negro o blanco según cuál se lea, y fondos y grises neutros en vez de
 * los azulados de FOTOFFICE. Es la variante "A" que eligió Daniel.
 *
 * No usa los colores del sitio público (`accentColor` y compañía) a propósito: varios negocios
 * los tienen cargados para su sitio, y prenderlos en el panel les cambiaría la pantalla sin aviso.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** `#abc` o `#aabbcc`, con o sin `#`, a `#aabbcc` en minúsculas. `null` si no es un color. */
export function normalizarColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let t = raw.trim().toLowerCase();
  if (t === "") return null;
  if (!t.startsWith("#")) t = `#${t}`;
  if (/^#[0-9a-f]{3}$/.test(t)) t = `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  return HEX.test(t) ? t : null;
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function aHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mezcla con otro color: `peso` 0 deja el original, 1 da el otro. */
function mezclar(hex: string, con: [number, number, number], peso: number): string {
  const c = rgb(hex);
  return aHex([0, 1, 2].map((i) => c[i] + (con[i] - c[i]) * peso) as [number, number, number]);
}

/** Luminancia relativa (WCAG). */
function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** El texto que se lee mejor sobre el color: negro casi puro o blanco. */
export function textoSobre(hex: string): string {
  const negro = "#111111";
  return contraste(hex, negro) >= contraste(hex, "#ffffff") ? negro : "#ffffff";
}

export type TemaPanel = {
  /** Variables para todo el panel (`:root`). */
  general: Record<string, string>;
  /** Variables sólo para el menú lateral, que va negro. */
  menu: Record<string, string>;
};

export function temaDelPanel(color: string): TemaPanel {
  const [r, g, b] = rgb(color);
  return {
    general: {
      "--fo-accent": color,
      "--fo-accent-hover": mezclar(color, [0, 0, 0], 0.12),
      "--fo-accent-soft": mezclar(color, [255, 255, 255], 0.85),
      "--fo-accent-muted": `rgba(${r}, ${g}, ${b}, 0.16)`,
      "--fo-on-accent": textoSobre(color),
      // Neutros sin el tinte azul de FOTOFFICE: blanco, grises y negro.
      "--fo-bg": "#f5f5f4",
      "--fo-surface-hover": "#f0f0ef",
      "--fo-surface-muted": "#e7e7e5",
      "--fo-border": "#e4e4e2",
      "--fo-border-strong": "#d4d4d2",
      "--fo-border-muted": "#f0f0ef",
      "--fo-text": "#111111",
      "--fo-text-secondary": "#3a3a3a",
      "--fo-muted": "#6b6b6b",
      "--fo-muted-soft": "#9a9a9a",
      "--fo-code-bg": "#f0f0ef",
    },
    menu: {
      "--fo-bg-elevated": "#0d0d0d",
      "--fo-bg": "#171717",
      "--fo-surface": "#171717",
      "--fo-surface-hover": "#1f1f1f",
      "--fo-border": "#262626",
      "--fo-border-strong": "#333333",
      "--fo-text": "#f5f5f5",
      "--fo-text-secondary": "#d4d4d4",
      "--fo-muted": "#a3a3a3",
      "--fo-muted-soft": "#737373",
      "--fo-accent-muted": `rgba(${r}, ${g}, ${b}, 0.18)`,
    },
  };
}

/** El CSS listo para un `<style>`: todo el panel y, aparte, el menú lateral. */
export function cssDelTema(color: string): string {
  const tema = temaDelPanel(color);
  const decl = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `${k}:${v};`)
      .join("");
  return `:root{${decl(tema.general)}}#fo-shell-nav{${decl(tema.menu)}}`;
}
