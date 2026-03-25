import type { Metadata } from "next";
import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";
import ComprameLaFotoDesignProvider from "@/components/providers/ComprameLaFotoDesignProvider";

const siteUrl =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_COMPRAMELAFOTO_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";

const defaultTitle = "ComprameLaFoto - Compra y descarga tus fotos digitales e impresas";
const defaultDescription =
  "Plataforma para comprar y descargar fotografías digitales e impresas. Los fotógrafos pueden vender sus fotos y los clientes pueden comprarlas en formato digital o impreso.";

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl) : undefined,
  title: defaultTitle,
  description: defaultDescription,
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ComprameLaFoto",
    statusBarStyle: "default",
  },
  /** Favicon / pestaña: `app/icon.png` + `app/apple-icon.png` (Next.js) + `public/Ico/*` (manifest). */
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "ComprameLaFoto",
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/og-image.png",
        width: 512,
        height: 512,
        alt: "ComprameLaFoto",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/og-image.png"],
  },
  /** Pestaña y touch: `app/icon.png` + `app/apple-icon.png`. Manifest usa `/Ico/*` para PWA. */
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ComprameLaFotoDesignProvider>
          <MainLayout>{children}</MainLayout>
        </ComprameLaFotoDesignProvider>
      </body>
    </html>
  );
}
