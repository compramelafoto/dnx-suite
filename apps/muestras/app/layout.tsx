import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { Encabezado } from "@/components/encabezado/encabezado";
import { Pie } from "@/components/pie/pie";
import "./globals.css";

/** Una sola familia para todo el sitio. Los títulos se distinguen con `.mf-titulo`. */
const fuente = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--mf-font" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://muestrasfotograficas.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "Muestras Fotográficas", template: "%s | Muestras Fotográficas" },
  description: "El mapa de las muestras y actividades de fotografía de todo el país.",
  openGraph: {
    siteName: "Muestras Fotográficas",
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
