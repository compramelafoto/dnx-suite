import localFont from "next/font/local";

/**
 * Fuentes locales (woff2 latinos de Fontsource). Nunca `next/font/google`: el build no depende de
 * una descarga externa.
 * - Archivo: todo el texto.
 * - IBM Plex Mono: sólo números de serie y cantidades leídas de metadatos.
 */
export const fuenteTexto = localFont({
  src: [
    { path: "./archivo-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./archivo-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./archivo-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-texto",
  display: "swap",
  fallback: ["system-ui", "Helvetica Neue", "Arial", "sans-serif"],
});

export const fuenteSerie = localFont({
  src: [{ path: "./ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" }],
  variable: "--font-serie",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "Consolas", "monospace"],
});
