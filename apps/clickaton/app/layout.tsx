import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { siteConfig } from "@/config/site";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-ck-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const sans = DM_Sans({
  variable: "--font-ck-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.nameFull,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary",
    title: siteConfig.nameFull,
    description: siteConfig.description,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFE600",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${display.variable} ${sans.variable}`}>
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
