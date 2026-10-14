import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Tipografías guardadas en el proyecto (app/_fonts, del juego latino de Fontsource) en lugar de
 * `next/font/google`: esa opción las bajaba de Google en cada publicación y, cuando Google
 * tardaba o respondía mal, la publicación fallaba ("An error occurred in next/font"). Son las
 * mismas familias y pesos de antes.
 */

// El manual fija Montserrat. Sólo tres pesos: cada peso extra son kilobytes que
// paga el invitado con datos móviles en un salón.
const montserrat = localFont({
  variable: "--slf-font",
  src: [
    { path: "./_fonts/montserrat-400.woff2", weight: "400", style: "normal" },
    { path: "./_fonts/montserrat-500.woff2", weight: "500", style: "normal" },
    { path: "./_fonts/montserrat-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
});

// Sólo para las plantillas donde el papel importa: la invitación de casamiento y el
// diploma. Dos familias en total, no una por plantilla.
const cormorant = localFont({
  variable: "--slf-font-serif",
  src: [
    { path: "./_fonts/cormorant-garamond-400.woff2", weight: "400", style: "normal" },
    { path: "./_fonts/cormorant-garamond-600.woff2", weight: "600", style: "normal" },
    { path: "./_fonts/cormorant-garamond-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

// Letra de cartel: condensada y en caja alta, pensada para leerse de lejos. Es la que
// mejor funciona proyectada en la pared de un salón. Un solo peso, que es todo lo que
// tiene la familia.
const bebas = localFont({
  variable: "--slf-font-cartel",
  src: [{ path: "./_fonts/bebas-neue-400.woff2", weight: "400", style: "normal" }],
  display: "swap",
});

// Manuscrita, para cumpleaños y eventos de confianza. Dos pesos: el regular para el
// cuerpo y el grueso para los títulos.
const caveat = localFont({
  variable: "--slf-font-mano",
  src: [
    { path: "./_fonts/caveat-400.woff2", weight: "400", style: "normal" },
    { path: "./_fonts/caveat-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://subilafoto.com"),
  title: "SubiLaFoto",
  description:
    "Todas las miradas de tu evento, en un solo lugar. Los invitados escanean un código, suben sus fotos y aparecen en la pantalla y en el álbum.",
  icons: {
    icon: [
      { url: "/brand/subilafoto-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/subilafoto-icon-256.png", sizes: "256x256", type: "image/png" },
    ],
    apple: "/brand/subilafoto-icon-512.png",
  },
  openGraph: {
    title: "SubiLaFoto",
    description: "Todas las miradas de tu evento, en un solo lugar.",
    url: "https://subilafoto.com",
    siteName: "SubiLaFoto",
    locale: "es_AR",
    type: "website",
    images: [{ url: "/brand/subilafoto-avatar-1080.png", width: 1080, height: 1080 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#200638",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${montserrat.variable} ${cormorant.variable} ${bebas.variable} ${caveat.variable}`}>
      <body style={{ fontFamily: "var(--slf-font), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
