import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { siteConfig } from "@/config/site";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";
import "./globals.css";

/*
 * Tipografías guardadas en el proyecto (app/fonts, del juego latino de Fontsource) en lugar de
 * `next/font/google`: esa opción las bajaba de Google en cada publicación y, cuando Google
 * tardaba o respondía mal, la publicación fallaba ("An error occurred in next/font"), aunque el
 * cambio no tocara Clickatón. Son las mismas familias y pesos de antes.
 */
const display = localFont({
  variable: "--font-ck-display",
  src: [{ path: "./fonts/bebas-neue-400.woff2", weight: "400", style: "normal" }],
  display: "swap",
});

const sans = localFont({
  variable: "--font-ck-sans",
  src: [
    { path: "./fonts/montserrat-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const accent = localFont({
  variable: "--font-ck-accent",
  src: [
    { path: "./fonts/caveat-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/caveat-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.nameFull,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  metadataBase: new URL(resolveClickatonPublicOrigin()),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/brand/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.png"],
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: resolveClickatonPublicOrigin(),
    siteName: siteConfig.name,
    title: siteConfig.nameFull,
    description: siteConfig.description,
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: siteConfig.nameFull,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.nameFull,
    description: siteConfig.description,
    images: ["/og-default.png"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${display.variable} ${sans.variable} ${accent.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
