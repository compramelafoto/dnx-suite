import type { Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Una sola familia para todo el sitio: Archivo, variable en peso y en ancho. El texto va con el
 * ancho normal; los títulos (`.mf-titulo`) y el nombre del banner (`.mf-nombre`) se angostan.
 *
 * El archivo está en el proyecto (app/_fonts, juego latino de Fontsource, con los ejes de peso y
 * de ancho) en lugar de `next/font/google`: esa opción lo bajaba de Google en cada publicación y,
 * cuando Google tardaba o respondía mal, la publicación fallaba ("An error occurred in next/font").
 */
const fuente = localFont({
  src: [{ path: "./_fonts/archivo-variable-wdth.woff2", weight: "100 900", style: "normal" }],
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  variable: "--mf-font",
});

export const viewport: Viewport = { themeColor: "#ffffff" };

/**
 * Raíz común a las dos marcas: sólo el documento, la fuente y los estilos. Está fuera de
 * `[marca]` porque Next no puede armar el 404 dentro de un layout raíz con segmento dinámico (lo
 * mandaba suelto, sin `lang="es"` ni fuente). Los textos, metadatos, encabezado y pie de cada
 * marca están en `app/[marca]/layout.tsx`.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={fuente.variable}>
      <body className="flex min-h-dvh flex-col antialiased">{children}</body>
    </html>
  );
}
