import type { Metadata } from "next";
import "./globals.css";
import MainLayout from "@/components/layout/MainLayout";
import ComprameLaFotoDesignProvider from "@/components/providers/ComprameLaFotoDesignProvider";
import { getPublicSiteOrigin } from "@/lib/public-site-url";

const defaultTitle = "ComprameLaFoto - Compra y descarga tus fotos digitales e impresas";
const defaultDescription =
  "Plataforma para comprar y descargar fotografías digitales e impresas. Los fotógrafos pueden vender sus fotos y los clientes pueden comprarlas en formato digital o impreso.";

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOrigin()),
  title: defaultTitle,
  description: defaultDescription,
  icons: {
    icon: [{ url: "/Ico/favicon-16x16.png", sizes: "16x16", type: "image/png" }],
    shortcut: "/Ico/favicon-16x16.png",
    apple: "/Ico/apple-touch-icon.png",
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    images: [{ url: "/watermark.png" }],
  },
  twitter: {
    card: "summary",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/watermark.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
