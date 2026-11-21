import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Encabezado } from "@/components/encabezado/encabezado";
import { Pie } from "@/components/pie/pie";
import { origenPublico } from "@/lib/marca";
import { marcaDeParams } from "@/lib/ruta-marca";
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

/** Las dos marcas se generan en la publicación; cualquier otro segmento es un 404. */
export function generateStaticParams() {
  return [{ marca: "fotografia" }, { marca: "arte" }];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<"/[marca]">): Promise<Metadata> {
  const marca = await marcaDeParams(params);
  return {
    metadataBase: new URL(origenPublico(marca)),
    title: { default: marca.nombre, template: `%s | ${marca.nombre}` },
    description: marca.descripcion,
    openGraph: {
      siteName: marca.nombre,
      description: marca.descripcion,
      locale: "es_AR",
      type: "website",
      images: [marca.imagenRedes],
    },
    icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/[marca]">) {
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
