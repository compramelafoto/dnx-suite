import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Encabezado } from "@/components/encabezado/encabezado";
import { Pie } from "@/components/pie/pie";
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://muestrasfotograficas.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "Muestras Fotográficas", template: "%s | Muestras Fotográficas" },
  description: "Muestras de fotografía para ver en persona, en todo el país: dónde quedan, fechas, horarios y cómo llegar.",
  openGraph: {
    siteName: "Muestras Fotográficas",
    description: "Muestras de fotografía para ver en persona, en todo el país: dónde quedan, fechas, horarios y cómo llegar.",
    locale: "es_AR",
    type: "website",
    images: ["/brand/muestras-logo-1254.webp"],
  },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={fuente.variable}>
      <body className="flex min-h-dvh flex-col antialiased">
        <Encabezado />
        <div className="flex-1">{children}</div>
        <Pie />
      </body>
    </html>
  );
}
