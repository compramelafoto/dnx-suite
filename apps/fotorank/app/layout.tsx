import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";

const defaultTitle = "FotoRank | Plataforma de Concursos Fotográficos";
const defaultDescription =
  "Donde la fotografía compite, se destaca y deja huella. Plataforma premium para crear, participar y posicionar concursos fotográficos.";

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl) : undefined,
  title: defaultTitle,
  description: defaultDescription,
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "FotoRank",
    statusBarStyle: "black-translucent",
  },
  /** Icono de pestaña y favicon: `app/icon.png` + `app/apple-icon.png` (convención Next.js). */
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "FotoRank",
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/og-image.png",
        width: 512,
        height: 512,
        alt: "FotoRank — apertura y trofeo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
