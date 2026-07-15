import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Caveat, Montserrat } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { siteConfig } from "@/config/site";
import "./globals.css";

const display = Bebas_Neue({
  variable: "--font-ck-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const sans = Montserrat({
  variable: "--font-ck-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const accent = Caveat({
  variable: "--font-ck-accent",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.nameFull,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  metadataBase: new URL(siteConfig.url),
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
    url: siteConfig.url,
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
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido-principal"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:border-2 focus:border-ck-border-strong focus:bg-ck-yellow focus:px-4 focus:py-2 focus:font-semibold focus:text-ck-black"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        <main id="contenido-principal">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
