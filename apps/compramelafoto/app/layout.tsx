import type { Metadata } from "next";
import "./globals.css";
import ComprameLaFotoDesignProvider from "@/components/providers/ComprameLaFotoDesignProvider";

const siteUrl =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_COMPRAMELAFOTO_URL?.trim() ||
  process.env.AUTH_URL?.trim() ||
  "";

const defaultTitle = "ComprameLaFoto — Import monorepo (Oleada 0)";
const defaultDescription =
  "Esqueleto inicial de ComprameLaFoto en el monorepo DNX Suite. La app completa se importará en oleadas posteriores.";

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl) : undefined,
  title: defaultTitle,
  description: defaultDescription,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ComprameLaFotoDesignProvider>{children}</ComprameLaFotoDesignProvider>
      </body>
    </html>
  );
}
