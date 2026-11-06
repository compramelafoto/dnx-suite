import localFont from "next/font/local";

/**
 * DejaVu Sans, la letra de apoyo del manual de marca de SOYBELUZ (juego latino de Fontsource).
 * La usa el sitio público cuando el diseño la elige (`FontOption.local`). Va con `preload: false`
 * para que los sitios que no la eligen no la descarguen: el navegador sólo baja una letra cuando
 * algún texto la usa.
 */
export const dejavuSans = localFont({
  variable: "--font-dejavu-sans",
  src: [
    { path: "./dejavu-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./dejavu-sans-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
});
