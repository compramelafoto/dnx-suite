import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const texto = Inter({ subsets: ["latin"], variable: "--mf-font" });
const titulos = Fraunces({ subsets: ["latin"], variable: "--mf-serif" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://muestrasfotograficas.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "Muestras Fotográficas", template: "%s · Muestras Fotográficas" },
  description: "El mapa de las muestras y actividades de fotografía de todo el país.",
  openGraph: { siteName: "Muestras Fotográficas", locale: "es_AR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#f6f4ef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${titulos.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
