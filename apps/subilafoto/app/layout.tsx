import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

// El manual fija Montserrat. Sólo tres pesos: cada peso extra son kilobytes que
// paga el invitado con datos móviles en un salón.
const montserrat = Montserrat({
  variable: "--slf-font",
  subsets: ["latin"],
  weight: ["400", "500", "800"],
  display: "swap",
});

// Sólo para las plantillas donde el papel importa: la invitación de casamiento y el
// diploma. Dos familias en total, no una por plantilla.
const cormorant = Cormorant_Garamond({
  variable: "--slf-font-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://subilafoto.com"),
  title: "Subí la Foto",
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
    title: "Subí la Foto",
    description: "Todas las miradas de tu evento, en un solo lugar.",
    url: "https://subilafoto.com",
    siteName: "Subí la Foto",
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
    <html lang="es" className={`${montserrat.variable} ${cormorant.variable}`}>
      <body style={{ fontFamily: "var(--slf-font), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
